'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface ConsultantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  discipline: string;
  title: string | null;
  status: string;
  workingStatus: string;
  currentClient: { name: string } | null;
  location: string | null;
  yearsExperience: number | null;
  summary: string | null;
  otherFormationNotes: string | null;
  userId: string | null;
  keywords: { keyword: { id: string; label: string; type: string }; source: string; confidence: number | null }[];
  resumes: { id: string; fileName: string; createdAt: string; isFormatted: boolean }[];
  tickets: {
    id: string;
    expiryDate: string | null;
    documentUrl: string | null;
    ticketType: { label: string };
  }[];
  evaluations: {
    id: string;
    overallScore: number;
    overallComments: string | null;
    safetyScore: number;
    safetyComments: string | null;
    knowledgeScore: number;
    knowledgeComments: string | null;
    reportingScore: number;
    reportingComments: string | null;
    professionalismScore: number;
    professionalismComments: string | null;
    wouldRecommend: boolean | null;
    evaluatorName: string | null;
    evaluatorCompany: string | null;
    createdAt: string;
  }[];
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ConsultantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id as string;
  const [consultant, setConsultant] = useState<ConsultantDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ fileName: string; type: string; message: string }[] | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDiscipline, setEditDiscipline] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [copyingInvite, setCopyingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/consultants/${id}`)
      .then((r) => r.json())
      .then((d) => setConsultant(d.consultant));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(newStatus: string) {
    setStatusSaving(true);
    await fetch(`/api/consultants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusSaving(false);
    load();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Permanently delete ${consultant?.firstName} ${consultant?.lastName}? This removes their profile, tickets, resumes, and evaluations. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/consultants/${id}`, { method: 'DELETE' });
    setDeleting(false);

    if (res.ok) {
      router.push('/consultants');
    } else {
      alert('Failed to delete consultant.');
    }
  }

  async function handleCopyInviteLink() {
    setCopyingInvite(true);
    const res = await fetch(`/api/consultants/${id}/invite-link`, { method: 'POST' });
    const data = await res.json();
    setCopyingInvite(false);

    if (!res.ok) {
      alert(data.error || 'Failed to get invite link');
      return;
    }

    const url = `${window.location.origin}/signup/${data.token}`;
    await navigator.clipboard.writeText(url);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  }

  function startEditingContact() {
    setEditFirstName(consultant?.firstName || '');
    setEditLastName(consultant?.lastName || '');
    setEditEmail(consultant?.email || '');
    setEditPhone(consultant?.phone || '');
    setEditLocation(consultant?.location || '');
    setEditTitle(consultant?.title || '');
    setEditDiscipline(consultant?.discipline || 'ALL');
    setEditingContact(true);
  }

  async function handleSaveContact() {
    if (!editFirstName.trim() || !editLastName.trim()) {
      alert('First and last name cannot be empty');
      return;
    }
    setSavingContact(true);
    await fetch(`/api/consultants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail || null,
        phone: editPhone || null,
        location: editLocation || null,
        title: editTitle || null,
        discipline: editDiscipline,
      }),
    });
    setSavingContact(false);
    setEditingContact(false);
    load();
  }

  async function handleSendReminder() {
    setSendingReminder(true);
    const res = await fetch(`/api/consultants/${id}/send-profile-reminder`, { method: 'POST' });
    const data = await res.json();
    setSendingReminder(false);

    if (!res.ok) {
      alert(data.error || 'Failed to send reminder');
      return;
    }
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 2500);
  }

  async function handleCopyProfileLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/my-profile`);
    setProfileLinkCopied(true);
    setTimeout(() => setProfileLinkCopied(false), 2500);
  }

  function startEditingSummary() {
    setSummaryDraft(consultant?.summary || '');
    setEditingSummary(true);
  }

  async function handleSaveSummary() {
    setSavingSummary(true);
    await fetch(`/api/consultants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: summaryDraft || null }),
    });
    setSavingSummary(false);
    setEditingSummary(false);
    load();
  }

  async function handleRegenerateSummary() {
    setRegeneratingSummary(true);
    const res = await fetch(`/api/consultants/${id}/regenerate-summary`, { method: 'POST' });
    const data = await res.json();
    setRegeneratingSummary(false);

    if (!res.ok) {
      alert(data.error || 'Failed to regenerate summary');
      return;
    }
    setSummaryDraft(data.summary);
    setEditingSummary(true); // show the new draft for review before it's considered "saved"
    load();
  }

  async function handleGenerateResume() {
    setGeneratingResume(true);
    setGenerateMessage('Reading resume and writing the Benchmark-formatted version… this can take a minute.');

    const res = await fetch(`/api/consultants/${id}/generate-resume`, { method: 'POST' });
    const data = await res.json();
    setGeneratingResume(false);

    if (!res.ok) {
      setGenerateMessage(data.error || 'Failed to generate resume');
      return;
    }
    setGenerateMessage('Done! The polished resume has been added below.');
    load();
  }

  async function handleDeleteResume(resumeId: string) {
    const confirmed = window.confirm('Delete this resume? This cannot be undone.');
    if (!confirmed) return;

    setDeletingResumeId(resumeId);
    await fetch(`/api/resumes/${resumeId}`, { method: 'DELETE' });
    setDeletingResumeId(null);
    load();
  }

  async function handleBulkUpload() {
    if (bulkFiles.length === 0) return;
    setBulkUploading(true);
    setBulkResults(null);

    const formData = new FormData();
    bulkFiles.forEach((f) => formData.append('files', f));

    const res = await fetch(`/api/consultants/${id}/bulk-upload`, { method: 'POST', body: formData });
    const data = await res.json();
    setBulkUploading(false);

    if (res.ok) {
      setBulkResults(data.results || []);
      setBulkFiles([]);
      load();
    } else {
      setBulkResults([{ fileName: '', type: 'error', message: data.error || 'Upload failed' }]);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage('Uploading and parsing with Claude…');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('consultantId', id);

    try {
      const res = await fetch('/api/resumes/parse', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadMessage(`Done — extracted ${data.parsed.keywords.length} keywords.`);
      load();
    } catch (err) {
      setUploadMessage((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!consultant) {
    return (
      <div>
        <NavBar />
        <p className="p-8 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const keywordsByType = consultant.keywords.reduce<Record<string, typeof consultant.keywords>>((acc, k) => {
    (acc[k.keyword.type] ||= []).push(k);
    return acc;
  }, {});

  return (
    <div>
      <NavBar />
      <PageHeader
        title={`${consultant.firstName} ${consultant.lastName}`}
        subtitle={`${consultant.title || 'No title'}${consultant.location ? ` · ${consultant.location}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {consultant.workingStatus === 'WORKING' && (
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-100">
                Working{consultant.currentClient ? ` — ${consultant.currentClient.name}` : ''}
              </span>
            )}
            {consultant.workingStatus === 'AVAILABLE' && (
              <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-100">
                Available
              </span>
            )}
            {['ADMIN', 'RECRUITER'].includes(session?.user?.role || '') ? (
              <select
                value={consultant.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusSaving}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                <option value="ACTIVE" className="text-slate-900">Active</option>
                <option value="BENCH" className="text-slate-900">Bench</option>
                <option value="PLACED" className="text-slate-900">Placed</option>
                <option value="INACTIVE" className="text-slate-900">Inactive</option>
              </select>
            ) : (
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                {consultant.status}
              </span>
            )}
            {session?.user?.role === 'ADMIN' && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-sm font-medium text-red-100 hover:bg-red-500/30 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        }
      />
      <main className="mx-auto max-w-4xl px-6 py-8">
        {!consultant.userId && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-gold-400/50 bg-gold-500/10 p-4">
            <div>
              <p className="text-sm font-semibold text-brand-900">No login yet</p>
              <p className="text-sm text-slate-600">
                This consultant hasn&apos;t set up their own login. If the invite email never
                arrived (or email isn&apos;t set up yet), copy the link directly and share it with
                them another way.
              </p>
            </div>
            <button
              onClick={handleCopyInviteLink}
              disabled={copyingInvite}
              className="shrink-0 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
            >
              {copyingInvite ? 'Getting link…' : inviteCopied ? 'Link copied!' : 'Copy invite link'}
            </button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Contact Info &amp; Title</h2>
            <div className="flex gap-2">
              {consultant.userId && (
                <>
                  <button
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {sendingReminder ? 'Sending…' : reminderSent ? 'Sent!' : 'Send complete-profile reminder'}
                  </button>
                  <button
                    onClick={handleCopyProfileLink}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {profileLinkCopied ? 'Copied!' : 'Copy profile link'}
                  </button>
                </>
              )}
              {!editingContact && (
                <button
                  onClick={startEditingContact}
                  className="rounded-md bg-gold-500 px-2.5 py-1 text-xs font-bold text-brand-900 hover:bg-gold-600"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {editingContact ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">First Name</label>
                  <input
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Last Name</label>
                  <input
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Discipline</label>
                  <select
                    value={editDiscipline}
                    onChange={(e) => setEditDiscipline(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="DRILLING">Drilling</option>
                    <option value="COMPLETIONS">Completions</option>
                    <option value="LEASE_CONSTRUCTION">Lease Construction</option>
                    <option value="ALL">All / Multiple</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Job Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Wellsite Supervisor"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Phone</label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Location</label>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveContact}
                  disabled={savingContact}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {savingContact ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingContact(false)}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-5">
              <div>
                <p className="text-xs text-slate-400">Discipline</p>
                <p className="text-slate-700">
                  {consultant.discipline === 'DRILLING' && 'Drilling'}
                  {consultant.discipline === 'COMPLETIONS' && 'Completions'}
                  {consultant.discipline === 'LEASE_CONSTRUCTION' && 'Lease Construction'}
                  {consultant.discipline === 'ALL' && 'All / Multiple'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Job Title</p>
                <p className="text-slate-700">{consultant.title || 'Not on file'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                {consultant.email ? (
                  <a href={`mailto:${consultant.email}`} className="text-brand-700 hover:underline">
                    {consultant.email}
                  </a>
                ) : (
                  <p className="text-slate-400">Not on file</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone</p>
                {consultant.phone ? (
                  <a href={`tel:${consultant.phone}`} className="text-brand-700 hover:underline">
                    {consultant.phone}
                  </a>
                ) : (
                  <p className="text-slate-400">Not on file</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Location</p>
                <p className="text-slate-700">{consultant.location || 'Not on file'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Summary</h2>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerateSummary}
                disabled={regeneratingSummary}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {regeneratingSummary ? 'Regenerating…' : 'Regenerate with AI'}
              </button>
              {!editingSummary && (
                <button
                  onClick={startEditingSummary}
                  className="rounded-md bg-gold-500 px-2.5 py-1 text-xs font-bold text-brand-900 hover:bg-gold-600"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {editingSummary ? (
            <div>
              <textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSaveSummary}
                  disabled={savingSummary}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {savingSummary ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingSummary(false)}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{consultant.summary || 'No summary on file yet.'}</p>
          )}
        </div>

        {consultant.otherFormationNotes && (
          <div className="mb-6 rounded-2xl border border-gold-400/40 bg-gold-500/10 p-4">
            <h2 className="mb-1 text-sm font-semibold text-brand-900">Other Formation (self-reported)</h2>
            <p className="text-sm text-brand-900">{consultant.otherFormationNotes}</p>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Keywords &amp; Skills</h2>
          {Object.keys(keywordsByType).length === 0 ? (
            <p className="text-sm text-slate-400">No keywords tagged yet. Upload a resume to auto-extract them.</p>
          ) : (
            Object.entries(keywordsByType).map(([type, kws]) => (
              <div key={type} className="mb-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{type}</p>
                <div className="flex flex-wrap gap-1.5">
                  {kws.map((k) => (
                    <span
                      key={k.keyword.id}
                      title={k.source === 'PARSED' ? `AI-extracted (confidence ${(k.confidence ?? 0).toFixed(2)})` : 'Manually tagged'}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                    >
                      {k.keyword.label} {k.source === 'PARSED' && '✨'}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Tickets (Certifications)</h2>
          {consultant.tickets.length === 0 ? (
            <p className="text-sm text-slate-400">No tickets on file yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {consultant.tickets.map((t) => {
                const days = t.expiryDate ? daysUntil(t.expiryDate) : null;
                return (
                  <li key={t.id} className="flex items-center justify-between">
                    <span className="text-slate-700">
                      {t.ticketType.label}
                      {t.documentUrl && (
                        <>
                          {' '}
                          <a
                            href={`/api/tickets/${t.id}/document`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-700 hover:underline"
                          >
                            (view document)
                          </a>
                        </>
                      )}
                    </span>
                    {days === null ? (
                      <span className="text-slate-400">N/A (no expiry)</span>
                    ) : (
                      <span className={days < 0 ? 'text-red-600' : days <= 60 ? 'text-amber-600' : 'text-slate-500'}>
                        {days < 0
                          ? `Expired ${new Date(t.expiryDate!).toLocaleDateString('en-CA')}`
                          : `Expires ${new Date(t.expiryDate!).toLocaleDateString('en-CA')}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Evaluations</h2>
          {consultant.evaluations.length === 0 ? (
            <p className="text-sm text-slate-400">No evaluations submitted yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {consultant.evaluations.map((e) => (
                <li key={e.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      {e.evaluatorName}
                      {e.evaluatorCompany ? ` · ${e.evaluatorCompany}` : ''}
                    </span>
                    {e.wouldRecommend !== null && (
                      <span
                        className={
                          e.wouldRecommend
                            ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                            : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                        }
                      >
                        {e.wouldRecommend ? 'Would recommend' : 'Would not recommend'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1.5 text-xs text-slate-500">
                    <div>
                      <span className="font-medium text-slate-700">Safety: {e.safetyScore}/5</span>
                      {e.safetyComments && <p className="text-slate-600">{e.safetyComments}</p>}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Knowledge: {e.knowledgeScore}/5</span>
                      {e.knowledgeComments && <p className="text-slate-600">{e.knowledgeComments}</p>}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Reporting: {e.reportingScore}/5</span>
                      {e.reportingComments && <p className="text-slate-600">{e.reportingComments}</p>}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Professionalism: {e.professionalismScore}/5</span>
                      {e.professionalismComments && <p className="text-slate-600">{e.professionalismComments}</p>}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Overall: {e.overallScore}/5</span>
                      {e.overallComments && <p className="text-slate-600">{e.overallComments}</p>}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{new Date(e.createdAt).toLocaleDateString('en-CA')}</p>
                  <Link href={`/admin/evaluations/${e.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                    View full evaluation →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Resumes</h2>
          <ul className="mb-4 space-y-1 text-sm text-slate-600">
            {consultant.resumes.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span>
                  <a
                    href={`/api/resumes/${r.id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    {r.fileName}
                  </a>{' '}
                  {r.isFormatted && (
                    <span className="ml-1 rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-medium text-brand-900">
                      Benchmark Format
                    </span>
                  )}{' '}
                  — {new Date(r.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDeleteResume(r.id)}
                  disabled={deletingResumeId === r.id}
                  className="ml-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  {deletingResumeId === r.id ? 'Deleting…' : 'Delete'}
                </button>
              </li>
            ))}
            {consultant.resumes.length === 0 && <li className="text-slate-400">No resumes uploaded yet.</li>}
          </ul>

          <div className="mb-4">
            <button
              onClick={handleGenerateResume}
              disabled={generatingResume}
              className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-bold text-white hover:bg-brand-900 disabled:opacity-50"
            >
              {generatingResume ? 'Generating…' : 'Generate Polished Benchmark Resume'}
            </button>
            {generateMessage && <p className="mt-2 text-xs text-slate-500">{generateMessage}</p>}
          </div>

          <label className="inline-block cursor-pointer rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600">
            {uploading ? 'Processing…' : 'Upload resume (PDF/DOCX)'}
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {uploadMessage && <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Upload Multiple Files</h3>
            <p className="mb-2 text-xs text-slate-500">
              Select several files at once (updated resumes, certification photos, driver&apos;s
              license, etc.) &mdash; it automatically figures out which is which, the same way the
              Bulk Folder Import does. Sensitive-named files are skipped automatically.
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
              className="text-sm"
            />
            {bulkFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{bulkFiles.length} file(s) selected</p>
            )}
            <div>
              <button
                onClick={handleBulkUpload}
                disabled={bulkFiles.length === 0 || bulkUploading}
                className="mt-2 rounded-lg bg-brand-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {bulkUploading ? 'Processing…' : 'Upload All'}
              </button>
            </div>

            {bulkResults && (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
                {bulkResults.map((r, i) => (
                  <li
                    key={i}
                    className={
                      r.type === 'error'
                        ? 'text-red-700'
                        : r.type === 'skipped'
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }
                  >
                    <span className="font-medium">{r.fileName}</span>: {r.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}