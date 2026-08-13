'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface ConsultantEval {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  evaluationToken: string | null;
  avgScore: number | null;
  evaluationCount: number;
  recentEvaluations: {
    id: string;
    overallScore: number;
    overallComments: string | null;
    evaluatorName: string | null;
    evaluatorCompany: string | null;
    wouldRecommend: boolean | null;
    createdAt: string;
  }[];
}

export default function EvaluationsPage() {
  const [consultants, setConsultants] = useState<ConsultantEval[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/evaluations')
      .then((r) => r.json())
      .then((d) => setConsultants(d.consultants || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function getLink(consultantId: string) {
    setBusyId(consultantId);
    const res = await fetch('/api/admin/evaluations/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultantId }),
    });
    const data = await res.json();
    setBusyId(null);

    if (data.token) {
      const url = `${window.location.origin}/evaluate/${data.token}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(consultantId);
      setTimeout(() => setCopiedId(null), 2000);
      load();
    }
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="Evaluations" subtitle="Generate a link to send a client for evaluating a consultant — no login needed on their end. Submitted evaluations show up here and on the consultant's profile." />
      <main className="mx-auto max-w-4xl px-6 py-8">

        <div className="space-y-3">
          {consultants.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-slate-500">{c.title || 'No title'}</p>
                </div>
                <div className="text-right">
                  {c.avgScore !== null ? (
                    <p className="text-lg font-semibold text-brand-900">
                      {c.avgScore.toFixed(1)} <span className="text-sm font-normal text-slate-400">/ 5</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">No evaluations yet</p>
                  )}
                  <p className="text-xs text-slate-400">{c.evaluationCount} submitted</p>
                </div>
              </div>

              {c.recentEvaluations.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm text-slate-600">
                  {c.recentEvaluations.map((e) => (
                    <li key={e.id}>
                      <span className="font-medium">{e.overallScore}/5</span>
                      {e.evaluatorName ? ` — ${e.evaluatorName}` : ''}
                      {e.evaluatorCompany ? ` (${e.evaluatorCompany})` : ''}
                      {e.wouldRecommend !== null && (
                        <span className={e.wouldRecommend ? ' text-green-700' : ' text-red-700'}>
                          {' '}
                          · {e.wouldRecommend ? 'Would recommend' : 'Would not recommend'}
                        </span>
                      )}
                      {e.overallComments ? `: ${e.overallComments}` : ''}
                      {' '}
                      <Link href={`/admin/evaluations/${e.id}`} className="font-medium text-brand-700 hover:underline">
                        View full →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => getLink(c.id)}
                disabled={busyId === c.id}
                className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {copiedId === c.id ? 'Link copied!' : 'Copy evaluation link'}
              </button>
            </div>
          ))}

          {consultants.length === 0 && <p className="text-sm text-slate-500">No consultants yet.</p>}
        </div>
      </main>
    </div>
  );
}