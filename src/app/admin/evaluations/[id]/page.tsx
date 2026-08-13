'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface Evaluation {
  id: string;
  consultant: { id: string; firstName: string; lastName: string; title: string | null };
  evaluatorName: string | null;
  evaluatorEmail: string | null;
  evaluatorCompany: string | null;
  directSupervisor: string | null;
  evaluatorTitle: string | null;
  typeOfWork: string | null;
  lengthOfWork: string | null;
  safetyScore: number;
  safetyComments: string | null;
  knowledgeScore: number;
  knowledgeComments: string | null;
  reportingScore: number;
  reportingComments: string | null;
  professionalismScore: number;
  professionalismComments: string | null;
  overallScore: number;
  overallComments: string | null;
  wouldRecommend: boolean | null;
  createdAt: string;
}

const RATING_LABELS = ['', 'Poor', 'Acceptable', 'Satisfactory', 'Good', 'Excellent'];

function CategoryRow({ label, score, comments }: { label: string; score: number; comments: string | null }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
          {score}/5 &middot; {RATING_LABELS[score]}
        </span>
      </div>
      {comments && <p className="mt-1 text-sm text-slate-600">{comments}</p>}
    </div>
  );
}

export default function FullEvaluationPage() {
  const params = useParams();
  const id = params.id as string;
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    fetch(`/api/evaluations/${id}`)
      .then((r) => r.json())
      .then((d) => setEvaluation(d.evaluation));
  }, [id]);

  if (!evaluation) {
    return (
      <div>
        <NavBar />
        <PageHeader title="Evaluation" subtitle="Loading…" />
      </div>
    );
  }

  return (
    <div>
      <NavBar />
      <PageHeader
        title={`Evaluation — ${evaluation.consultant.firstName} ${evaluation.consultant.lastName}`}
        subtitle={new Date(evaluation.createdAt).toLocaleString('en-CA')}
        action={
          <Link
            href={`/consultants/${evaluation.consultant.id}`}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            ← Back to profile
          </Link>
        }
      />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* Header info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Evaluation Details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">O&amp;G Company</p>
              <p className="text-slate-700">{evaluation.evaluatorCompany || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Direct Supervisor</p>
              <p className="text-slate-700">{evaluation.directSupervisor || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Type of Work</p>
              <p className="text-slate-700">{evaluation.typeOfWork || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Length of Work</p>
              <p className="text-slate-700">{evaluation.lengthOfWork || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Evaluator</p>
              <p className="text-slate-700">
                {evaluation.evaluatorName || '—'}
                {evaluation.evaluatorTitle ? ` — ${evaluation.evaluatorTitle}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Evaluator Email</p>
              {evaluation.evaluatorEmail ? (
                <a href={`mailto:${evaluation.evaluatorEmail}`} className="text-brand-700 hover:underline">
                  {evaluation.evaluatorEmail}
                </a>
              ) : (
                <p className="text-slate-700">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Recommend for hire */}
        {evaluation.wouldRecommend !== null && (
          <div
            className={
              evaluation.wouldRecommend
                ? 'rounded-2xl border border-green-200 bg-green-50 p-4 text-center'
                : 'rounded-2xl border border-red-200 bg-red-50 p-4 text-center'
            }
          >
            <p className={evaluation.wouldRecommend ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
              {evaluation.wouldRecommend ? '✓ Would recommend for hire' : '✗ Would not recommend for hire'}
            </p>
          </div>
        )}

        {/* Category ratings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Ratings</h2>
          <CategoryRow label="Safety Awareness" score={evaluation.safetyScore} comments={evaluation.safetyComments} />
          <CategoryRow label="Industry Related Knowledge" score={evaluation.knowledgeScore} comments={evaluation.knowledgeComments} />
          <CategoryRow label="Reporting & Paperwork" score={evaluation.reportingScore} comments={evaluation.reportingComments} />
          <CategoryRow label="Professionalism" score={evaluation.professionalismScore} comments={evaluation.professionalismComments} />
          <CategoryRow label="Overall" score={evaluation.overallScore} comments={evaluation.overallComments} />
        </div>
      </main>
    </div>
  );
}