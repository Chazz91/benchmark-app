'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';
import clsx from 'clsx';

interface ExpiringTicket {
  id: string;
  expiryDate: string | null;
  expiryNoticeSentAt: string | null;
  expiryNotice30SentAt: string | null;
  ticketType: { label: string };
  consultant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
    currentClient: { name: string } | null;
  };
}

function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default function TicketsExpiringPage() {
  const [tickets, setTickets] = useState<ExpiringTicket[]>([]);
  const [days, setDays] = useState(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/tickets/expiring?days=${days}`)
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <NavBar />
      <PageHeader
        title="Tickets Expiring Soon"
        subtitle="Exactly who needs a push, on top of the automated reminder emails already going out to them directly."
      />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-slate-600">Show tickets expiring within</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing expiring in this window.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => {
              const remaining = t.expiryDate ? daysUntil(t.expiryDate) : null;
              const expired = remaining !== null && remaining < 0;
              return (
                <Link
                  key={t.id}
                  href={`/consultants/${t.consultant.id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-gold-500"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {t.consultant.firstName} {t.consultant.lastName}
                      {t.consultant.currentClient && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          · {t.consultant.currentClient.name}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      {t.ticketType.label}
                      {t.consultant.email ? ` · ${t.consultant.email}` : ''}
                      {t.consultant.phone ? ` · ${t.consultant.phone}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t.expiryNotice30SentAt
                        ? '30-day reminder sent'
                        : t.expiryNoticeSentAt
                          ? '60-day reminder sent'
                          : 'No reminder sent yet'}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                      expired
                        ? 'bg-red-100 text-red-700'
                        : remaining !== null && remaining <= 30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {t.expiryDate
                      ? expired
                        ? `Expired ${Math.abs(remaining!)}d ago`
                        : `${remaining}d left · ${new Date(t.expiryDate).toLocaleDateString('en-CA')}`
                      : 'N/A'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
