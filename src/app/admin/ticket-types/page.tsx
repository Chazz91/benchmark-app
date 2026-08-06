'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface TicketType {
  id: string;
  label: string;
  discipline: string;
  validMonths: number;
  hasExpiry: boolean;
}

export default function TicketTypesPage() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [label, setLabel] = useState('');
  const [discipline, setDiscipline] = useState('ALL');
  const [validMonths, setValidMonths] = useState('36');
  const [hasExpiry, setHasExpiry] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/ticket-types')
      .then((r) => r.json())
      .then((d) => setTicketTypes(d.ticketTypes || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setCreating(true);
    await fetch('/api/admin/ticket-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, discipline, validMonths: parseInt(validMonths, 10), hasExpiry }),
    });
    setLabel('');
    setValidMonths('36');
    setHasExpiry(true);
    setCreating(false);
    load();
  }

  async function handleToggleExpiry(t: TicketType) {
    await fetch('/api/admin/ticket-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: t.label,
        discipline: t.discipline,
        validMonths: t.validMonths,
        hasExpiry: !t.hasExpiry,
      }),
    });
    load();
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="Ticket Types" subtitle="The master list of required safety certifications." />
      <main className="mx-auto max-w-3xl px-6 py-8">

        <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-3 gap-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. H2S Alive"
              className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
            />
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="DRILLING">Drilling</option>
              <option value="COMPLETIONS">Completions</option>
              <option value="LEASE_CONSTRUCTION">Lease Construction</option>
              <option value="ALL">All</option>
            </select>
            <input
              type="number"
              min={1}
              value={validMonths}
              onChange={(e) => setValidMonths(e.target.value)}
              placeholder="Valid months"
              disabled={!hasExpiry}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={hasExpiry}
              onChange={(e) => setHasExpiry(e.target.checked)}
            />
            This certification expires and needs renewal
          </label>
          <button
            type="submit"
            disabled={creating}
            className="mt-3 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
          >
            {creating ? 'Saving…' : 'Add ticket type'}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="p-3">Label</th>
                <th className="p-3">Discipline</th>
                <th className="p-3">Valid for (months)</th>
                <th className="p-3">Expires?</th>
              </tr>
            </thead>
            <tbody>
              {ticketTypes.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3">{t.label}</td>
                  <td className="p-3">{t.discipline}</td>
                  <td className="p-3">{t.hasExpiry ? t.validMonths : '—'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleExpiry(t)}
                      className={
                        t.hasExpiry
                          ? 'rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200'
                          : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
                      }
                    >
                      {t.hasExpiry ? 'Yes' : 'N/A (no expiry)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

