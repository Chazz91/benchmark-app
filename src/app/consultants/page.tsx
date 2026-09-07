'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';
import clsx from 'clsx';

type KeywordType = 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE';

interface Keyword {
  id: string;
  label: string;
  type: KeywordType;
}

interface Consultant {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  status: string;
  discipline: string;
  workingStatus: string;
  currentClient: { name: string } | null;
  location: string | null;
  yearsExperience: number | null;
  keywords: { keyword: Keyword; source: string }[];
}

const TYPE_LABELS: Record<KeywordType, string> = {
  FORMATION: 'Formations',
  RIG_TYPE: 'Rig Types',
  SKILL: 'Skills',
  CERTIFICATION: 'Certifications',
  SOFTWARE: 'Software',
};

export default function ConsultantsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);

  // Load full keyword taxonomy once, for the toggle panel
  useEffect(() => {
    fetch('/api/keywords')
      .then((r) => r.json())
      .then((d) => setKeywords(d.keywords || []));
  }, []);

  const runSearch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (discipline) params.set('discipline', discipline);
    if (selected.size > 0) params.set('keywordIds', Array.from(selected).join(','));
    params.set('matchMode', matchMode);

    fetch(`/api/consultants?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setConsultants(d.consultants || []))
      .finally(() => setLoading(false));
  }, [query, status, discipline, selected, matchMode]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(runSearch, 300); // debounce toggles/search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, matchMode, status, discipline]);

  function toggleKeyword(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (checkedIds.size === consultants.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(consultants.map((c) => c.id)));
    }
  }

  const grouped = keywords.reduce<Record<string, Keyword[]>>((acc, kw) => {
    (acc[kw.type] ||= []).push(kw);
    return acc;
  }, {});

  return (
    <div>
      <NavBar />
      <PageHeader title="Consultants" subtitle="Search and filter your consultant roster by formation, rig type, skill, and more." />
      <main className="mx-auto max-w-7xl gap-6 px-6 py-8 lg:flex">
        {/* Filter sidebar */}
        <aside className="mb-6 w-full shrink-0 lg:mb-0 lg:w-72">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Keyword Filters</h2>
              <div className="flex rounded-md border border-slate-200 text-xs">
                <button
                  onClick={() => setMatchMode('any')}
                  className={clsx('px-2 py-1', matchMode === 'any' ? 'bg-gold-500 text-brand-900' : 'text-slate-600')}
                >
                  Any
                </button>
                <button
                  onClick={() => setMatchMode('all')}
                  className={clsx('px-2 py-1', matchMode === 'all' ? 'bg-gold-500 text-brand-900' : 'text-slate-600')}
                >
                  All
                </button>
              </div>
            </div>

            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(grouped[type] || []).map((kw) => (
                    <button
                      key={kw.id}
                      onClick={() => toggleKeyword(kw.id)}
                      className={clsx(
                        'rounded-full border px-2.5 py-1 text-xs',
                        selected.has(kw.id)
                          ? 'border-gold-500 bg-gold-500 text-brand-900'
                          : 'border-slate-300 text-slate-600 hover:border-brand-600'
                      )}
                    >
                      {kw.label}
                    </button>
                  ))}
                  {(grouped[type] || []).length === 0 && (
                    <p className="text-xs text-slate-400">None yet</p>
                  )}
                </div>
              </div>
            ))}

            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-brand-700 hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        {/* Results */}
        <section className="flex-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search name, title, location…"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="BENCH">Bench</option>
              <option value="PLACED">Placed</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All disciplines</option>
              <option value="DRILLING">Drilling</option>
              <option value="COMPLETIONS">Completions</option>
              <option value="LEASE_CONSTRUCTION">Lease Construction</option>
              <option value="ALL">All / Multiple</option>
            </select>
            <button
              onClick={runSearch}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600"
            >
              Search
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : consultants.length === 0 ? (
            <p className="text-sm text-slate-500">No consultants match these filters.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={checkedIds.size > 0 && checkedIds.size === consultants.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Select all {consultants.length} shown
                </label>
                {checkedIds.size > 0 && (
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600"
                  >
                    Message Selected ({checkedIds.size})
                  </button>
                )}
              </div>

              {consultants.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(c.id)}
                    onChange={() => toggleChecked(c.id)}
                    className="mt-5 h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <Link
                    href={`/consultants/${c.id}`}
                    className="block flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-gold-500"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {c.title || 'No title'} {c.location ? `· ${c.location}` : ''}{' '}
                          {c.yearsExperience ? `· ${c.yearsExperience} yrs` : ''}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {c.discipline === 'DRILLING' && 'Drilling'}
                          {c.discipline === 'COMPLETIONS' && 'Completions'}
                          {c.discipline === 'LEASE_CONSTRUCTION' && 'Lease Construction'}
                          {c.discipline === 'ALL' && 'All / Multiple'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            c.workingStatus === 'WORKING' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          )}
                        >
                          {c.workingStatus === 'WORKING'
                            ? `Working${c.currentClient ? ` · ${c.currentClient.name}` : ''}`
                            : 'Available'}
                        </span>
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            c.status === 'ACTIVE' && 'bg-green-100 text-green-700',
                            c.status === 'BENCH' && 'bg-amber-100 text-amber-700',
                            c.status === 'PLACED' && 'bg-blue-100 text-blue-700',
                            c.status === 'INACTIVE' && 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                    {c.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.keywords.slice(0, 8).map((k) => (
                          <span
                            key={k.keyword.id}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {k.keyword.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {composeOpen && (
        <ComposeModal
          consultants={consultants.filter((c) => checkedIds.has(c.id))}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            setCheckedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({
  consultants,
  onClose,
  onSent,
}: {
  consultants: Consultant[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ sentCount: number; skipped: string[] } | null>(null);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both a subject and a message.');
      return;
    }
    setSending(true);
    setError('');

    const res = await fetch('/api/admin/consultants/bulk-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consultantIds: consultants.map((c) => c.id),
        subject,
        message,
      }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }
    setResult(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {result ? (
          <div>
            <h2 className="mb-2 text-lg font-semibold text-green-700">Sent!</h2>
            <p className="text-sm text-slate-600">
              Your message went out to {result.sentCount} consultant(s) individually — none of
              them can see who else received it.
            </p>
            {result.skipped.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Skipped (no email on file): {result.skipped.join(', ')}
              </p>
            )}
            <button
              onClick={onSent}
              className="mt-4 w-full rounded-lg bg-gold-500 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <h2 className="mb-1 text-lg font-semibold text-brand-900">Message Selected Consultants</h2>
            <p className="mb-4 text-sm text-slate-500">
              Sending to {consultants.length} consultant(s), individually — no one will see who
              else got this. Replies will come straight to your own inbox.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Quick check-in"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Hi everyone, just checking in..."
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 rounded-lg bg-gold-500 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
                >
                  {sending ? 'Sending…' : `Send to ${consultants.length}`}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
