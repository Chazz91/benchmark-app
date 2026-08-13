'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  discipline: string;
  hasCanadianPassport: boolean;
  hasUSPassport: boolean;
  yearsExperience: number | null;
  title: string | null;
  parsedSummary: string | null;
  otherFormationNotes: string | null;
  resumeUrl: string | null;
  createdAt: string;
  keywords: { keyword: { id: string; label: string; type: string }; confidence: number | null }[];
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/applications?status=PENDING')
      .then((r) => r.json())
      .then((d) => setApplications(d.applications || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/applications/${id}/accept`, { method: 'POST' });
    setBusyId(null);
    load();
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Optional reason (sent to the applicant):') || undefined;
    setBusyId(id);
    await fetch(`/api/admin/applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="Applications" subtitle="Review submitted applications. Accepting creates their consultant profile and emails them a link to set up their own login." />
      <main className="mx-auto max-w-4xl px-6 py-8">

        {applications.length === 0 && (
          <p className="text-sm text-slate-500">No pending applications right now.</p>
        )}

        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {app.firstName} {app.lastName}
                  </p>
                  {app.title && <p className="text-sm text-slate-600">{app.title}</p>}
                  <p className="text-sm text-slate-500">
                    {app.email} {app.phone ? `· ${app.phone}` : ''} · {app.discipline}
                    {app.yearsExperience ? ` · ${app.yearsExperience} yrs` : ''}
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    <span
                      className={
                        app.hasCanadianPassport
                          ? 'inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                          : 'inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                      }
                    >
                      {app.hasCanadianPassport ? 'Confirmed Canadian passport' : 'No passport confirmation on file'}
                    </span>
                    <span
                      className={
                        app.hasUSPassport
                          ? 'inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'
                          : 'inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500'
                      }
                    >
                      {app.hasUSPassport ? 'Has US passport' : 'No US passport'}
                    </span>
                  </div>
                </div>
                {app.resumeUrl && (
                  <a
                    href={`/api/admin/applications/${app.id}/resume`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 hover:underline"
                  >
                    View resume
                  </a>
                )}
              </div>

              {app.parsedSummary && <p className="mt-2 text-sm text-slate-600">{app.parsedSummary}</p>}

              {app.otherFormationNotes && (
                <p className="mt-2 rounded-md bg-gold-500/10 p-2 text-sm text-brand-900">
                  <span className="font-semibold">Other formation noted: </span>
                  {app.otherFormationNotes}
                </p>
              )}

              {app.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {app.keywords.map((k) => (
                    <span
                      key={k.keyword.id}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {k.keyword.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAccept(app.id)}
                  disabled={busyId === app.id}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(app.id)}
                  disabled={busyId === app.id}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}