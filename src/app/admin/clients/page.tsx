'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface TicketType {
  id: string;
  label: string;
}

interface RequiredEntry {
  ticketType: TicketType;
  discipline: string;
}

interface ClientCompany {
  id: string;
  name: string;
  requiredTicketTypes: RequiredEntry[];
}

type Selection = '' | 'DRILLING' | 'COMPLETIONS' | 'LEASE_CONSTRUCTION' | 'ALL';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [allTicketTypes, setAllTicketTypes] = useState<TicketType[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []));
    fetch('/api/admin/ticket-types')
      .then((r) => r.json())
      .then((d) => setAllTicketTypes(d.ticketTypes || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setCreating(true);
    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName }),
    });
    setNewClientName('');
    setCreating(false);
    load();
  }

  function currentSelection(client: ClientCompany, ticketTypeId: string): Selection {
    const entry = client.requiredTicketTypes.find((r) => r.ticketType.id === ticketTypeId);
    return entry ? (entry.discipline as Selection) : '';
  }

  async function updateRequirement(clientId: string, ticketTypeId: string, selection: Selection) {
    await fetch(`/api/admin/clients/${clientId}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketTypeId,
        required: selection !== '',
        discipline: selection || undefined,
      }),
    });
    load();
  }

  return (
    <div>
      <NavBar />
      <PageHeader
        title="Clients"
        subtitle="Manage the companies your consultants work for, and which tickets each one requires — per discipline."
      />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Add a client company</p>
          <div className="flex gap-3">
            <input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="e.g. Cenovus"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{client.name}</p>
                  <p className="text-sm text-slate-500">
                    {client.requiredTicketTypes.length} ticket type(s) required
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  {expandedId === client.id ? 'Close' : 'Manage requirements'}
                </button>
              </div>

              {expandedId === client.id && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Required ticket types for {client.name}
                  </p>
                  <div className="space-y-1.5">
                    {allTicketTypes.map((tt) => {
                      const selection = currentSelection(client, tt.id);
                      return (
                        <div
                          key={tt.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">{tt.label}</span>
                          <select
                            value={selection}
                            onChange={(e) => updateRequirement(client.id, tt.id, e.target.value as Selection)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">Not required</option>
                            <option value="DRILLING">Drilling only</option>
                            <option value="COMPLETIONS">Completions only</option>
                            <option value="LEASE_CONSTRUCTION">Lease Construction only</option>
                            <option value="ALL">All disciplines</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {clients.length === 0 && <p className="text-sm text-slate-500">No clients added yet.</p>}
        </div>
      </main>
    </div>
  );
}