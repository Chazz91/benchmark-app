'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';
import clsx from 'clsx';

interface TicketType {
  id: string;
  label: string;
  discipline: string;
  validMonths: number;
  hasExpiry: boolean;
}

interface Ticket {
  id: string;
  ticketTypeId: string;
  ticketType: TicketType;
  issueDate: string;
  expiryDate: string | null;
  documentUrl: string | null;
}

interface DetectedTicket {
  label: string;
  matchedTicketTypeId?: string;
  matchedTicketTypeLabel?: string;
  issueDate?: string;
  expiryDate?: string;
  confidence: number;
}

interface ReviewRow extends DetectedTicket {
  selectedTicketTypeId: string;
  issueDateEdit: string;
  expiryDateEdit: string;
  noExpiryEdit: boolean;
  include: boolean;
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function MyTicketsPage() {
  const [requiredTypes, setRequiredTypes] = useState<TicketType[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Scan-a-photo flow
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(() => {
    fetch('/api/my/tickets')
      .then((r) => r.json())
      .then((d) => {
        setRequiredTypes(d.requiredTypes || []);
        setTickets(d.tickets || []);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function ticketFor(typeId: string) {
    return tickets.find((t) => t.ticketTypeId === typeId);
  }

  function startEditing(typeId: string) {
    const existing = ticketFor(typeId);
    const type = requiredTypes.find((t) => t.id === typeId);
    setEditingTypeId(typeId);
    setIssueDate(existing ? existing.issueDate.slice(0, 10) : '');
    setExpiryDate(existing?.expiryDate ? existing.expiryDate.slice(0, 10) : '');
    // Default the checkbox from this ticket's own current state if it exists, otherwise
    // from the type's usual default - either way, it's editable per-ticket from here.
    setNoExpiry(existing ? !existing.expiryDate : type?.hasExpiry === false);
    setFile(null);
  }

  async function handleSave(typeId: string) {
    if (!issueDate) return;
    if (!noExpiry && !expiryDate) return;
    setSaving(true);

    const formData = new FormData();
    formData.append('ticketTypeId', typeId);
    formData.append('issueDate', issueDate);
    formData.append('noExpiry', noExpiry ? 'true' : 'false');
    if (!noExpiry) formData.append('expiryDate', expiryDate);
    if (file) formData.append('file', file);

    await fetch('/api/my/tickets', { method: 'POST', body: formData });
    setSaving(false);
    setEditingTypeId(null);
    load();
  }

  async function handleScan() {
    if (!scanFile) return;
    setScanning(true);
    setScanError('');
    setReviewRows(null);

    const formData = new FormData();
    formData.append('file', scanFile);

    try {
      const res = await fetch('/api/my/tickets/parse-document', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that image');

      const rows: ReviewRow[] = (data.detected || []).map((d: DetectedTicket) => ({
        ...d,
        selectedTicketTypeId: d.matchedTicketTypeId || '',
        issueDateEdit: d.issueDate || '',
        expiryDateEdit: d.expiryDate || '',
        noExpiryEdit: !d.expiryDate,
        include: true,
      }));
      setReviewRows(rows);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function updateRow(index: number, changes: Partial<ReviewRow>) {
    setReviewRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...changes };
      return next;
    });
  }

  async function handleSaveReview() {
    if (!reviewRows) return;
    setSavingReview(true);

    const toSave = reviewRows.filter(
      (r) => r.include && r.selectedTicketTypeId && r.issueDateEdit && (r.noExpiryEdit || r.expiryDateEdit)
    );

    for (const row of toSave) {
      const formData = new FormData();
      formData.append('ticketTypeId', row.selectedTicketTypeId);
      formData.append('issueDate', row.issueDateEdit);
      formData.append('noExpiry', row.noExpiryEdit ? 'true' : 'false');
      if (!row.noExpiryEdit) formData.append('expiryDate', row.expiryDateEdit);
      if (scanFile) formData.append('file', scanFile);
      await fetch('/api/my/tickets', { method: 'POST', body: formData });
    }

    setSavingReview(false);
    setReviewRows(null);
    setScanFile(null);
    load();
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="My Tickets" subtitle="Keep your certifications up to date. You'll get an email reminder when one is within 60 days of expiring." />
      <main className="mx-auto max-w-3xl px-6 py-8">

        {/* Scan a photo section */}
        <div className="mb-6 rounded-2xl border border-gold-400/50 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-900">Scan a Ticket Photo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a photo or scan of one or more certification cards — even several laid out
            together in one photo — and it'll try to read the certification name, issue date,
            and expiry date for each one automatically. You'll get a chance to review and correct
            everything before it's saved.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setScanFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button
              onClick={handleScan}
              disabled={!scanFile || scanning}
              className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
            >
              {scanning ? 'Reading photo…' : 'Scan'}
            </button>
          </div>

          {scanError && <p className="mt-2 text-sm text-red-600">{scanError}</p>}

          {reviewRows && reviewRows.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Review before saving ({reviewRows.length} detected)
              </p>
              {reviewRows.map((row, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateRow(i, { include: e.target.checked })}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-slate-600">
                        Detected: <span className="font-medium text-slate-800">{row.label}</span>{' '}
                        <span className="text-xs text-slate-400">
                          ({Math.round(row.confidence * 100)}% confident)
                        </span>
                      </p>
                      <select
                        value={row.selectedTicketTypeId}
                        onChange={(e) => updateRow(i, { selectedTicketTypeId: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">-- Select the matching ticket type --</option>
                        {requiredTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <div className={clsx('grid gap-2', row.noExpiryEdit ? 'grid-cols-1' : 'grid-cols-2')}>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">
                            {row.noExpiryEdit ? 'Completion date' : 'Issue date'}
                          </label>
                          <input
                            type="date"
                            value={row.issueDateEdit}
                            onChange={(e) => updateRow(i, { issueDateEdit: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        {!row.noExpiryEdit && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Expiry date</label>
                            <input
                              type="date"
                              value={row.expiryDateEdit}
                              onChange={(e) => updateRow(i, { expiryDateEdit: e.target.value })}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={row.noExpiryEdit}
                          onChange={(e) => updateRow(i, { noExpiryEdit: e.target.checked })}
                        />
                        This one has no expiry date (N/A)
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveReview}
                  disabled={savingReview}
                  className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {savingReview ? 'Saving…' : 'Save Selected'}
                </button>
                <button
                  onClick={() => {
                    setReviewRows(null);
                    setScanFile(null);
                  }}
                  className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {reviewRows && reviewRows.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              Couldn't detect any certifications in that photo — try a clearer or better-lit shot.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {requiredTypes.map((type) => {
            const ticket = ticketFor(type.id);
            const days = ticket && ticket.expiryDate ? daysUntil(ticket.expiryDate) : null;
            const isEditing = editingTypeId === type.id;

            return (
              <div key={type.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{type.label}</p>
                    {ticket ? (
                      type.hasExpiry ? (
                        <p
                          className={clsx(
                            'text-sm',
                            days !== null && days < 0
                              ? 'text-red-600'
                              : days !== null && days <= 60
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          )}
                        >
                          {days !== null && days < 0
                            ? `Expired ${new Date(ticket.expiryDate!).toLocaleDateString('en-CA')}`
                            : `Expires ${new Date(ticket.expiryDate!).toLocaleDateString('en-CA')} (${days} days)`}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">On file · N/A (no expiry)</p>
                      )
                    ) : (
                      <p className="text-sm text-slate-400">Not on file yet</p>
                    )}
                    {ticket?.documentUrl && (
                      <a
                        href={`/api/tickets/${ticket.id}/document`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-700 hover:underline"
                      >
                        View uploaded document
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => startEditing(type.id)}
                    className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600"
                  >
                    {ticket ? (type.hasExpiry ? 'Renew / Update' : 'Update') : 'Add'}
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className={clsx('grid gap-3', noExpiry ? 'grid-cols-1' : 'grid-cols-2')}>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          {noExpiry ? 'Completion date' : 'Issue date'}
                        </label>
                        <input
                          type="date"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      {!noExpiry && (
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Expiry date</label>
                          <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={noExpiry}
                        onChange={(e) => setNoExpiry(e.target.checked)}
                      />
                      This one has no expiry date (N/A)
                    </label>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Upload proof (optional)</label>
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleSave(type.id)}
                        disabled={saving}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingTypeId(null)}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {requiredTypes.length === 0 && (
            <p className="text-sm text-slate-500">No ticket types have been set up yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}

