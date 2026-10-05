'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface MatchResult {
  consultantId: string;
  name: string;
  discipline: string;
  status: string;
  isCurrentlyHere: boolean;
  requiredCount: number;
  missing: string[];
  expiringSoon: { label: string; days: number }[];
}

const DISCIPLINE_LABELS: Record<string, string> = {
  DRILLING: 'Drilling',
  COMPLETIONS: 'Completions',
  LEASE_CONSTRUCTION: 'Lease Construction',
  ALL: 'All / Multiple',
};

function ConsultantRow({ r }: { r: MatchResult }) {
  const compliant = r.missing.length === 0;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
      <div>
        <Link href={`/consultants/${r.consultantId}`} className="text-sm font-medium text-brand-700 hover:underline">
          {r.name}
        </Link>
        <p className="text-xs text-slate-400">{DISCIPLINE_LABELS[r.discipline] || r.discipline}</p>
      </div>
      <div className="text-right">
        {r.requiredCount === 0 ? (
          <span className="text-xs text-slate-400">No requirements apply</span>
        ) : compliant ? (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            Compliant
          </span>
        ) : (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            Missing {r.missing.join(', ')}
          </span>
        )}
        {r.expiringSoon.length > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            {r.expiringSoon.map((e) => `${e.label} in ${e.days}d`).join(', ')}
          </p>
        )}
      </div>
    </li>
  );
}

export default function ClientMatchesPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [anyRequirements, setAnyRequirements] = useState(true);
  const [results, setResults] = useState<MatchResult[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}/matches`)
      .then((r) => r.json())
      .then((d) => {
        setClient(d.client);
        setAnyRequirements(d.anyRequirements);
        setResults(d.results || []);
      });
  }, [id]);

  if (!results || !client) {
    return (
      <div>
        <NavBar />
        <p className="p-8 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const currentlyHere = results.filter((r) => r.isCurrentlyHere);
  const eligibleElsewhere = results
    .filter((r) => !r.isCurrentlyHere && r.requiredCount > 0)
    .sort((a, b) => a.missing.length - b.missing.length || a.name.localeCompare(b.name));

  return (
    <div>
      <NavBar />
      <PageHeader
        title={`Consultant Matches — ${client.name}`}
        subtitle="Checks every consultant's tickets against what this client requires for their discipline."
      />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/admin/clients" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Clients
        </Link>

        {!anyRequirements && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            No ticket requirements are set up for {client.name} yet — add some under &quot;Manage
            requirements&quot; on the Clients page to see compliance here.
          </p>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Currently working at {client.name} ({currentlyHere.length})
          </h2>
          {currentlyHere.length === 0 ? (
            <p className="text-sm text-slate-400">No consultants are currently assigned to this client.</p>
          ) : (
            <ul className="space-y-2">
              {currentlyHere.map((r) => (
                <ConsultantRow key={r.consultantId} r={r} />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">
            Other consultants eligible for {client.name} ({eligibleElsewhere.length})
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Anyone not currently at {client.name} whose discipline has at least one requirement here —
            sorted so the most ticket-ready consultants are at the top.
          </p>
          {eligibleElsewhere.length === 0 ? (
            <p className="text-sm text-slate-400">No other consultants match this client&apos;s disciplines.</p>
          ) : (
            <ul className="space-y-2">
              {eligibleElsewhere.map((r) => (
                <ConsultantRow key={r.consultantId} r={r} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
