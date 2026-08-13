'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import clsx from 'clsx';

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  updatedAt: string;
  consultant: { firstName: string; lastName: string } | null;
  assignedTo: { name: string } | null;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch('/api/tickets')
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority }),
    });
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setCreating(false);
    load();
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Tickets</h1>

        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ticket title"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex items-center gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{t.title}</p>
                <div className="flex gap-2">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      t.priority === 'URGENT' && 'bg-red-100 text-red-700',
                      t.priority === 'HIGH' && 'bg-orange-100 text-orange-700',
                      t.priority === 'MEDIUM' && 'bg-amber-100 text-amber-700',
                      t.priority === 'LOW' && 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {t.priority}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {t.status}
                  </span>
                </div>
              </div>
              {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
              <p className="mt-2 text-xs text-slate-400">
                {t.consultant ? `Re: ${t.consultant.firstName} ${t.consultant.lastName} · ` : ''}
                Updated {new Date(t.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
          {tickets.length === 0 && <p className="text-sm text-slate-500">No tickets yet.</p>}
        </div>
      </main>
    </div>
  );
}