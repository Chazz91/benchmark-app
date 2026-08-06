import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Papa from 'papaparse';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveOrCreateKeyword } from '@/lib/keywords';

// Expected CSV columns (multi-value cells separated by semicolons ";"):
// FirstName,LastName,Email,Phone,Title,Discipline,YearsExperience,Location,Status,Summary,Formations,RigTypes,Skills,Certifications,Software
//
// Discipline: DRILLING | COMPLETIONS | BOTH
// Status: ACTIVE | BENCH | PLACED | INACTIVE
const KEYWORD_COLUMN_TYPES: Record<string, 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE'> = {
  Formations: 'FORMATION',
  RigTypes: 'RIG_TYPE',
  Skills: 'SKILL',
  Certifications: 'CERTIFICATION',
  Software: 'SOFTWARE',
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    try {
      if (!row.FirstName || !row.LastName) {
        errors.push({ row: i + 2, message: 'FirstName and LastName are required' });
        continue;
      }

      const data = {
        firstName: row.FirstName,
        lastName: row.LastName,
        email: row.Email || undefined,
        phone: row.Phone || undefined,
        title: row.Title || undefined,
        discipline: (['DRILLING', 'COMPLETIONS', 'LEASE_CONSTRUCTION', 'ALL'].includes(row.Discipline) ? row.Discipline : 'ALL') as
          | 'DRILLING'
          | 'COMPLETIONS'
          | 'LEASE_CONSTRUCTION'
          | 'ALL',
        yearsExperience: row.YearsExperience ? parseInt(row.YearsExperience, 10) : undefined,
        location: row.Location || undefined,
        status: (['ACTIVE', 'BENCH', 'PLACED', 'INACTIVE'].includes(row.Status) ? row.Status : 'ACTIVE') as
          | 'ACTIVE'
          | 'BENCH'
          | 'PLACED'
          | 'INACTIVE',
        summary: row.Summary || undefined,
      };

      // Upsert by email if provided, otherwise always create a new record
      let consultant;
      if (data.email) {
        const existing = await prisma.consultant.findFirst({ where: { email: data.email } });
        if (existing) {
          consultant = await prisma.consultant.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          consultant = await prisma.consultant.create({ data: { ...data, createdById: session.user.id } });
          created++;
        }
      } else {
        consultant = await prisma.consultant.create({ data: { ...data, createdById: session.user.id } });
        created++;
      }

      // Match/create keywords from the multi-value columns, highlighting them on the profile
      for (const [column, type] of Object.entries(KEYWORD_COLUMN_TYPES)) {
        const cell = row[column];
        if (!cell) continue;

        const labels = cell.split(';').map((s) => s.trim()).filter(Boolean);
        for (const label of labels) {
          const keyword = await resolveOrCreateKeyword(label, type);

          await prisma.consultantKeyword.upsert({
            where: { consultantId_keywordId: { consultantId: consultant.id, keywordId: keyword.id } },
            update: {},
            create: { consultantId: consultant.id, keywordId: keyword.id, source: 'MANUAL' },
          });
        }
      }
    } catch (err) {
      errors.push({ row: i + 2, message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_IMPORTED_CONSULTANTS',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { created, updated, errorCount: errors.length },
    },
  });

  return NextResponse.json({ created, updated, errors });
}

