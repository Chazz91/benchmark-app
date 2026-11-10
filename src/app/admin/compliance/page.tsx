'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface ComplianceItem {
  id: string;
  name: string;
  discipline: string;
  status: string;
  officeBased: boolean;
  missingTickets: string[];
  expiringTickets: { label: string; expiryDate: string; daysUntil: number }[];
  resumeStatus: 'none' | 'stale' | 'current';
  resumeLastUpdated: string | null;
  hasIssue: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  BENCH: 'bg-amber-100 text-amber-700',
  PLACED: 'bg-blue-100 text-blue-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
};

export default function CompliancePage() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [summary, setSummary] = useState<{ totalChecked: number; withIssues: number } | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/compliance?includeInactive=${includeInactive}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setSummary(d.summary || null);
        setLoading(false);
      });
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = onlyIssues ? items.filter((i) => i.hasIssue) : items;

  return (
    <div>
      <NavBar />
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Roster-wide snapshot of missing tickets, expiring certifications, and stale resumes."
      />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyIssues}
                onChange={(e) => setOnlyIssues(e.target.checked)}
              />
              Only show consultants with an open issue
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Include inactive consultants
            </label>
          </div>
          {summary && (
            <p className="text-sm font-medium text-slate-600">
              {summary.withIssues} of {summary.totalChecked} checked have an open issue
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-slate-500">
            {onlyIssues ? 'Nobody has an open issue right now.' : 'No consultants match these filters.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/consultants/${item.id}`} className="font-medium text-brand-700 hover:underline">
                      {item.name}
                    </Link>
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[item.status])}>
                      {item.status}
                    </span>
                    {item.officeBased && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Office-based
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Missing Tickets
                    </p>
                    {item.missingTickets.length === 0 ? (
                      <p className="mt-1 text-slate-400">None</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-red-700">
                        {item.missingTickets.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Expiring / Expired Tickets
                    </p>
                    {item.expiringTickets.length === 0 ? (
                      <p className="mt-1 text-slate-400">None</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {item.expiringTickets.map((t) => (
                          <li key={t.label} className={t.daysUntil < 0 ? 'text-red-700' : 'text-amber-600'}>
                            {t.label} —{' '}
                            {t.daysUntil < 0
                              ? `expired ${new Date(t.expiryDate).toLocaleDateString('en-CA')}`
                              : `${t.daysUntil} day(s)`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resume</p>
                    {item.resumeStatus === 'none' && <p className="mt-1 text-red-700">Never uploaded</p>}
                    {item.resumeStatus === 'stale' && (
                      <p className="mt-1 text-amber-600">
                        Stale — last updated{' '}
                        {item.resumeLastUpdated && new Date(item.resumeLastUpdated).toLocaleDateString('en-CA')}
                      </p>
                    )}
                    {item.resumeStatus === 'current' && <p className="mt-1 text-slate-400">Current</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
