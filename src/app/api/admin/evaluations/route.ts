import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultants = await prisma.consultant.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      evaluationLink: { select: { token: true } },
      evaluations: {
        select: {
          id: true,
          overallScore: true,
          overallComments: true,
          evaluatorName: true,
          evaluatorCompany: true,
          wouldRecommend: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { lastName: 'asc' },
  });

  const withStats = consultants.map((c) => {
    // "Overall" category score is used as the headline number for each consultant
    const scores = c.evaluations.map((e) => e.overallScore);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title,
      evaluationToken: c.evaluationLink?.token || null,
      avgScore,
      evaluationCount: scores.length,
      recentEvaluations: c.evaluations.slice(0, 3),
    };
  });

  return NextResponse.json({ consultants: withStats });
}