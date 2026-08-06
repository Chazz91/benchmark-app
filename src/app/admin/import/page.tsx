'use client';

import { useState } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

interface ResumeResult {
  fileName: string;
  status: 'created' | 'updated' | 'error';
  consultantName?: string;
  keywordsTagged?: number;
  message?: string;
}

interface FolderResult {
  folderName: string;
  consultantName?: string;
  resumeFile?: string;
  status: 'created' | 'updated' | 'error';
  ticketsCreated: number;
  ticketsNeedingReview: string[];
  filesSkippedForSafety?: string[];
  message?: string;
}

function FolderImportSection() {
  const [batch, setBatch] = useState<{ file: File; path: string }[]>([]);
  const [folderNames, setFolderNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [results, setResults] = useState<FolderResult[]>([]);

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newEntries = Array.from(fileList).map((file) => ({
      file,
      path: (file as any).webkitRelativePath || file.name,
    }));

    setBatch((prev) => [...prev, ...newEntries]);

    const newFolderNames = Array.from(new Set(newEntries.map((e) => e.path.split('/')[0])));
    setFolderNames((prev) => Array.from(new Set([...prev, ...newFolderNames])));

    e.target.value = '';
  }

  function handleClearBatch() {
    setBatch([]);
    setFolderNames([]);
    setResults([]);
  }

  async function handleUpload() {
    if (batch.length === 0) return;
    setUploading(true);
    setResults([]);

    // Fully granular: one Claude call per request, one request per file. Never bundles
    // multiple files into a single request, so nothing can time out no matter how large
    // a folder is - each step is small and fast, with live progress shown as it goes.
    for (let fi = 0; fi < folderNames.length; fi++) {
      const folderName = folderNames[fi];
      const filesInFolder = batch.filter((entry) => entry.path.split('/')[0] === folderName);

      const resumeEntries = filesInFolder.filter((entry) =>
        ['resume', 'cv'].some((hint) => entry.file.name.toLowerCase().includes(hint))
      );
      const fallbackResume =
        resumeEntries.length === 0
          ? filesInFolder.filter((entry) => /\.(pdf|docx)$/i.test(entry.file.name)).slice(0, 1)
          : [];
      const allResumeEntries = [...resumeEntries, ...fallbackResume];
      const resumePaths = new Set(allResumeEntries.map((entry) => entry.path));
      const otherEntries = filesInFolder.filter(
        (entry) => !resumePaths.has(entry.path) && /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(entry.file.name)
      );

      if (allResumeEntries.length === 0) {
        setResults((prev) => [
          ...prev,
          { folderName, status: 'error', ticketsCreated: 0, ticketsNeedingReview: [], message: 'No resume-like file (PDF/DOCX) found in this folder - skipped entirely' },
        ]);
        continue;
      }

      let consultantId: string | null = null;
      let consultantName = '';
      let isNew = false;
      let ticketsCreated = 0;
      const notes: string[] = [];
      const resumeFileNames: string[] = [];

      for (let i = 0; i < allResumeEntries.length; i++) {
        const entry = allResumeEntries[i];
        setProgressNote(`Folder ${fi + 1}/${folderNames.length} "${folderName}": reading resume "${entry.file.name}"…`);

        const fd = new FormData();
        fd.append('file', entry.file);
        fd.append('folderName', folderName);
        if (consultantId) fd.append('consultantId', consultantId);

        try {
          const res = await fetch('/api/admin/import/folder/resume', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok) {
            consultantId = data.consultantId;
            consultantName = data.consultantName;
            if (i === 0) isNew = data.isNew;
            resumeFileNames.push(entry.file.name);
          } else {
            notes.push(`${entry.file.name}: ${data.error}`);
          }
        } catch (err) {
          notes.push(`${entry.file.name}: request failed - ${(err as Error).message}`);
        }
      }

      if (!consultantId) {
        setResults((prev) => [
          ...prev,
          { folderName, status: 'error', ticketsCreated: 0, ticketsNeedingReview: notes, message: "Couldn't process any resume in this folder" },
        ]);
        continue;
      }

      for (let i = 0; i < otherEntries.length; i++) {
        const entry = otherEntries[i];
        setProgressNote(
          `Folder ${fi + 1}/${folderNames.length} "${folderName}": reading "${entry.file.name}" (${i + 1}/${otherEntries.length})…`
        );

        const fd = new FormData();
        fd.append('file', entry.file);
        fd.append('consultantId', consultantId);

        try {
          const res = await fetch('/api/admin/import/folder/document', { method: 'POST', body: fd });
          const data = await res.json();
          ticketsCreated += data.ticketsCreated || 0;
          if (data.notes) notes.push(...data.notes.map((n: string) => `${entry.file.name}: ${n}`));
        } catch (err) {
          notes.push(`${entry.file.name}: request failed - ${(err as Error).message}`);
        }
      }

      setResults((prev) => [
        ...prev,
        {
          folderName,
          consultantName,
          resumeFile: resumeFileNames.join(', '),
          status: isNew ? 'created' : 'updated',
          ticketsCreated,
          ticketsNeedingReview: notes,
        },
      ]);
    }

    setProgressNote('');
    setUploading(false);
  }

  return (
    <div className="rounded-2xl border border-gold-400/50 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-900">Bulk Folder Import</h2>
      <p className="mt-1 text-sm text-slate-500">
        Select a folder to add it to the batch below - click "Choose Folder" again to add more
        specific consultant folders one at a time, or just select one big parent folder
        containing everyone if you'd rather do it all in one shot. Every file is processed
        individually (one at a time), so nothing times out no matter how large a folder is - it
        finds every resume-like file (some consultants have more than one on file, and each
        helps fill in anything the other is missing) and creates or updates that consultant,
        tagging their keywords. Every other file in the folder (certifications, driver's
        license, etc.) gets read the same way as the ticket photo scanner and added as tickets
        on their profile. Files with names suggesting banking, payroll, tax, or other sensitive
        company documents are automatically skipped entirely and never opened or sent anywhere
        - but it's still worth keeping those files out of these folders if you can.
      </p>

      <div className="mt-3">
        <input
          type="file"
          // @ts-ignore - webkitdirectory is a real, widely-supported attribute not in the TS DOM types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="text-sm"
        />
        {folderNames.length > 0 && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200 p-2">
            <p className="mb-2 text-xs font-medium text-slate-600">
              {folderNames.length} folder(s) queued ({batch.length} file(s) total):
            </p>
            {folderNames.map((name) => {
              const filesInFolder = batch.filter((entry) => entry.path.split('/')[0] === name);
              return (
                <div key={name} className="mb-2 last:mb-0">
                  <p className="text-xs font-semibold text-brand-900">{name}</p>
                  <ul className="ml-3 list-inside list-disc text-xs text-slate-500">
                    {filesInFolder.map((entry, i) => (
                      <li key={i}>{entry.path.split('/').slice(1).join('/') || entry.file.name}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleUpload}
          disabled={batch.length === 0 || uploading}
          className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
        >
          {uploading ? 'Processing…' : `Import ${folderNames.length > 0 ? `${folderNames.length} Folder(s)` : 'Folder'}`}
        </button>
        {batch.length > 0 && !uploading && (
          <button
            onClick={handleClearBatch}
            className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
          >
            Clear batch
          </button>
        )}
      </div>

      {progressNote && <p className="mt-3 text-sm text-slate-500">{progressNote}</p>}

      {results.length > 0 && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className={
                r.status === 'error'
                  ? 'rounded-md bg-red-50 p-2 text-sm text-red-700'
                  : 'rounded-md bg-slate-50 p-2 text-sm text-slate-700'
              }
            >
              <p className="font-medium">{r.folderName}</p>
              {r.status === 'error' ? (
                <p>{r.message}</p>
              ) : (
                <>
                  <p>
                    {r.status === 'created' ? 'Created' : 'Updated'} {r.consultantName} from{' '}
                    <span className="text-slate-500">{r.resumeFile}</span> · {r.ticketsCreated} ticket(s) added
                  </p>
                  {r.ticketsNeedingReview.length > 0 && (
                    <div className="mt-1 rounded bg-amber-50 p-1.5 text-xs text-amber-700">
                      <p className="font-medium">Notes:</p>
                      <ul className="list-inside list-disc">
                        {r.ticketsNeedingReview.map((msg, j) => (
                          <li key={j}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Since every file is now processed one at a time, a folder with many documents will take
        a bit longer overall, but each individual step stays fast and reliable - watch the
        progress line above to see exactly what it's working on.
      </p>
    </div>
  );
}
function ResumeImportSection() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResumeResult[] | null>(null);
  const [summary, setSummary] = useState<{ created: number; updated: number } | null>(null);

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setResults(null);
    setSummary(null);

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const res = await fetch('/api/admin/import/resumes', { method: 'POST', body: formData });
    const data = await res.json();
    setUploading(false);
    setSummary({ created: data.created || 0, updated: data.updated || 0 });
    setResults(data.results || []);
  }

  return (
    <div className="rounded-2xl border border-gold-400/50 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-900">Bulk Resume Upload</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload multiple resumes at once. For each one, Claude reads the resume and automatically
        pulls out the full name, email, phone, location, title, and years of experience —
        then creates a new consultant (or updates an existing one if the email matches an
        existing profile) and tags every formation, rig type, skill, certification, and software
        keyword it finds, so they're immediately toggleable in the Consultants search filters.
      </p>

      <div className="mt-3">
        <input
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="text-sm"
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">{files.length} file(s) selected</p>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="mt-3 rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
      >
        {uploading ? `Processing ${files.length} resume(s)…` : 'Upload & Import'}
      </button>

      {summary && (
        <p className="mt-3 text-sm text-green-700">
          {summary.created} consultant(s) created, {summary.updated} updated.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
          {results.map((r, i) => (
            <li
              key={i}
              className={r.status === 'error' ? 'text-red-700' : 'text-slate-700'}
            >
              <span className="font-medium">{r.fileName}</span>
              {r.status === 'error' ? (
                <span> — {r.message}</span>
              ) : (
                <span>
                  {' '}
                  — {r.status === 'created' ? 'created' : 'updated'} {r.consultantName}
                  {typeof r.keywordsTagged === 'number' ? `, ${r.keywordsTagged} keyword(s) tagged` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Tip: if you have a large number of resumes, upload them in batches of ~15-20 at a time
        to stay under most hosting providers&apos; upload size limits.
      </p>
    </div>
  );
}

function ImportSection({
  title,
  description,
  columns,
  endpoint,
}: {
  title: string;
  description: string;
  columns: string;
  endpoint: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();
    setUploading(false);
    setResult(data);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <p className="mt-2 rounded-md bg-slate-50 p-2 font-mono text-xs text-slate-600">{columns}</p>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
        >
          {uploading ? 'Importing…' : 'Import'}
        </button>
      </div>

      {result && (
        <div className="mt-3 text-sm">
          <p className="text-green-700">
            {result.created} created, {result.updated} updated.
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2 rounded-md bg-red-50 p-2 text-red-700">
              <p className="font-medium">{result.errors.length} row(s) had issues:</p>
              <ul className="mt-1 list-inside list-disc">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <div>
      <NavBar />
      <PageHeader title="Bulk Import" subtitle="Import your existing consultants, resumes, and tickets." />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="space-y-6">
          <FolderImportSection />
          <ResumeImportSection />

          <div>
            <p className="mb-3 text-sm text-slate-500">
              Or import from spreadsheets — for multi-value columns (like Formations or
              Skills), separate multiple values with a semicolon ( ; ) since commas are used to
              separate CSV columns.
            </p>
            <div className="space-y-6">
              <ImportSection
                title="Import Consultants (CSV)"
                description="Creates new consultants, or updates an existing one if the Email matches. Values in the taxonomy columns are automatically matched or added to your keyword list and tagged on the consultant's profile."
                columns="FirstName,LastName,Email,Phone,Title,Discipline,YearsExperience,Location,Status,Summary,Formations,RigTypes,Skills,Certifications,Software"
                endpoint="/api/admin/import/consultants"
              />

              <ImportSection
                title="Import Tickets (CSV)"
                description="Matches each row to a consultant by email and a ticket type by name (set up ticket types first in Admin > Ticket Types). Leave ExpiryDate blank to auto-calculate it from the ticket type's default validity period, or type N/A if that specific consultant's ticket doesn't expire."
                columns="ConsultantEmail,TicketType,IssueDate,ExpiryDate"
                endpoint="/api/admin/import/tickets"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

