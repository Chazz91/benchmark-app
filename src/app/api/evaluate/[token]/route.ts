import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - fetch basic consultant info to display on the public evaluation form
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const link = await prisma.evaluationLink.findUnique({
    where: { token: params.token },
    include: { consultant: { select: { firstName: true, lastName: true, title: true } } },
  });

  if (!link) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });

  return NextResponse.json({ consultant: link.consultant });
}

// POST - the full 5-category evaluation form, public, no login
export async function POST(request: Request, { params }: { params: { token: string } }) {
  const link = await prisma.evaluationLink.findUnique({ where: { token: params.token } });
  if (!link) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });

  const body = await request.json();
  const {
    evaluatorName,
    evaluatorEmail,
    evaluatorCompany,
    directSupervisor,
    evaluatorTitle,
    typeOfWork,
    lengthOfWork,
    safetyScore,
    safetyComments,
    knowledgeScore,
    knowledgeComments,
    reportingScore,
    reportingComments,
    professionalismScore,
    professionalismComments,
    overallScore,
    overallComments,
    wouldRecommend,
  } = body;

  const scores = [safetyScore, knowledgeScore, reportingScore, professionalismScore, overallScore];
  if (!evaluatorName || scores.some((s) => !s || s < 1 || s > 5)) {
    return NextResponse.json(
      { error: 'evaluatorName and a rating (1-5) for every category are required' },
      { status: 400 }
    );
  }

  await prisma.evaluation.create({
    data: {
      consultantId: link.consultantId,
      evaluatorName,
      evaluatorEmail: evaluatorEmail || undefined,
      evaluatorCompany: evaluatorCompany || undefined,
      directSupervisor: directSupervisor || undefined,
      evaluatorTitle: evaluatorTitle || undefined,
      typeOfWork: typeOfWork || undefined,
      lengthOfWork: lengthOfWork || undefined,
      safetyScore,
      safetyComments: safetyComments || undefined,
      knowledgeScore,
      knowledgeComments: knowledgeComments || undefined,
      reportingScore,
      reportingComments: reportingComments || undefined,
      professionalismScore,
      professionalismComments: professionalismComments || undefined,
      overallScore,
      overallComments: overallComments || undefined,
      wouldRecommend: typeof wouldRecommend === 'boolean' ? wouldRecommend : undefined,
    },
  });

  return NextResponse.json({ success: true });
}