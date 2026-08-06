'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

interface Formation {
  id: string;
  label: string;
}

export default function ApplyPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    discipline: 'DRILLING',
    yearsExperience: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [hasCanadianPassport, setHasCanadianPassport] = useState<'' | 'yes' | 'no'>('');
  const [hasUSPassport, setHasUSPassport] = useState<'' | 'yes' | 'no'>('');
  const [formations, setFormations] = useState<Formation[]>([]);
  const [selectedFormations, setSelectedFormations] = useState<Set<string>>(new Set());
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [otherFormationNotes, setOtherFormationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/keywords?type=FORMATION')
      .then((r) => r.json())
      .then((d) => setFormations(d.keywords || []));
  }, []);

  function toggleFormation(id: string, label: string) {
    if (label === 'Other') {
      setIsOtherSelected((prev) => !prev);
      return;
    }
    setSelectedFormations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (hasCanadianPassport !== 'yes') {
      setError('A valid Canadian passport is required to submit an application at this time.');
      return;
    }
    if (hasUSPassport === '') {
      setError('Please answer the US passport question.');
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => formData.append(key, value));
    if (file) formData.append('file', file);
    formData.append('formationIds', Array.from(selectedFormations).join(','));
    if (isOtherSelected) formData.append('otherFormationNotes', otherFormationNotes);
    formData.append('hasCanadianPassport', 'true');
    formData.append('hasUSPassport', hasUSPassport === 'yes' ? 'true' : 'false');

    try {
      const res = await fetch('/api/apply', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 via-brand-800 to-brand-600">
      {/* Header */}
      <header className="border-b border-white/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo showTagline size="lg" />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/5 px-4 py-1.5 text-sm font-medium text-gold-300">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          Now accepting consultant applications
        </span>

        <h1 className="font-heading text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          Work With the Best <span className="text-gold-400">Oil &amp; Gas Teams</span> in Western
          Canada
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
          Benchmark Engineering connects experienced drilling and completions consultants with
          operators across Alberta, BC, and Saskatchewan. Submit your resume and we&apos;ll reach
          out when there&apos;s a fit.
        </p>
      </section>

      {/* Application form card */}
      <section className="mx-auto max-w-xl px-6 pb-16">
        {done ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-2xl">
            <h2 className="mb-2 text-xl font-semibold text-brand-900">Application received</h2>
            <p className="text-sm text-slate-600">
              Thanks for applying to Benchmark Engineering. We&apos;ll review your resume and be
              in touch by email if you&apos;re moved forward.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="mb-1 text-lg font-semibold text-brand-900">Submit Your Resume</h2>
            <p className="mb-6 text-sm text-slate-500">
              Takes less than 2 minutes · No account required
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
                <input
                  required
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
              </div>
              <input
                required
                type="email"
                placeholder="Email — you'll use this to log in later if accepted"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              />
              <input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.discipline}
                  onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
                >
                  <option value="DRILLING">Drilling</option>
                  <option value="COMPLETIONS">Completions</option>
                  <option value="LEASE_CONSTRUCTION">Lease Construction</option>
                  <option value="ALL">All / Multiple</option>
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Years of experience"
                  value={form.yearsExperience}
                  onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Do you have a valid Canadian passport? <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasCanadianPassport('yes')}
                    className={
                      hasCanadianPassport === 'yes'
                        ? 'flex-1 rounded-lg border border-green-600 bg-green-50 py-2 text-sm font-medium text-green-700'
                        : 'flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600'
                    }
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasCanadianPassport('no')}
                    className={
                      hasCanadianPassport === 'no'
                        ? 'flex-1 rounded-lg border border-red-600 bg-red-50 py-2 text-sm font-medium text-red-700'
                        : 'flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600'
                    }
                  >
                    No
                  </button>
                </div>
                {hasCanadianPassport === 'no' && (
                  <p className="mt-2 text-xs text-red-600">
                    Unfortunately, a valid Canadian passport is required to apply at this time.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Do you have a valid US passport? <span className="text-red-600">*</span>
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  Not required to apply.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasUSPassport('yes')}
                    className={
                      hasUSPassport === 'yes'
                        ? 'flex-1 rounded-lg border border-green-600 bg-green-50 py-2 text-sm font-medium text-green-700'
                        : 'flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600'
                    }
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasUSPassport('no')}
                    className={
                      hasUSPassport === 'no'
                        ? 'flex-1 rounded-lg border border-slate-500 bg-slate-100 py-2 text-sm font-medium text-slate-700'
                        : 'flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600'
                    }
                  >
                    No
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Formations you&apos;ve worked in
                </label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {formations.map((f) => {
                      const active = f.label === 'Other' ? isOtherSelected : selectedFormations.has(f.id);
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => toggleFormation(f.id, f.label)}
                          className={
                            active
                              ? 'rounded-full border border-gold-500 bg-gold-500 px-2.5 py-1 text-xs text-brand-900'
                              : 'rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-gold-500'
                          }
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isOtherSelected && (
                  <textarea
                    value={otherFormationNotes}
                    onChange={(e) => setOtherFormationNotes(e.target.value)}
                    placeholder="Tell us which formation(s) — not seeing yours listed above"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Resume (PDF or DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting || hasCanadianPassport !== 'yes' || hasUSPassport === ''}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 py-3 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : (
                  <>
                    Submit Your Resume
                    <span aria-hidden>→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </section>

      <footer className="pb-6 text-center">
        <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300">
          Staff sign in
        </Link>
      </footer>
    </div>
  );
}

