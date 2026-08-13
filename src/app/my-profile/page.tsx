'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';
import clsx from 'clsx';

interface ClientCompany {
  id: string;
  name: string;
}

interface ResumeEntry {
  id: string;
  fileName: string;
  createdAt: string;
}

interface EvaluationEntry {
  id: string;
  overallScore: number;
  safetyScore: number;
  knowledgeScore: number;
  reportingScore: number;
  professionalismScore: number;
  wouldRecommend: boolean | null;
  evaluatorCompany: string | null;
  createdAt: string;
}

interface ConsultantProfile {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  workingStatus: 'AVAILABLE' | 'WORKING';
  currentClientId: string | null;
  resumes: ResumeEntry[];
  evaluations: EvaluationEntry[];
}

export default function MyProfilePage() {
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [clients, setClients] = useState<ClientCompany[]>([]);

  const [workingStatus, setWorkingStatus] = useState<'AVAILABLE' | 'WORKING'>('AVAILABLE');
  const [currentClientId, setCurrentClientId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ fileName: string; type: string; message: string }[] | null>(null);

  const load = useCallback(() => {
    fetch('/api/my/profile')
      .then((r) => r.json())
      .then((d) => {
        const c: ConsultantProfile = d.consultant;
        setProfile(c);
        setClients(d.clients || []);
        setWorkingStatus(c?.workingStatus || 'AVAILABLE');
        setCurrentClientId(c?.currentClientId || '');
        setPhone(c?.phone || '');
        setEmail(c?.email || '');
        setLocation(c?.location || '');
        setBio(c?.bio || '');
        setEmergencyContactName(c?.emergencyContactName || '');
        setEmergencyContactPhone(c?.emergencyContactPhone || '');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/my/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workingStatus,
        currentClientId: currentClientId || null,
        phone,
        email,
        location,
        bio,
        emergencyContactName,
        emergencyContactPhone,
      }),
    });
    setSaving(false);
    setSaved(true);
    load();
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleResumeUpload() {
    if (!resumeFile) return;
    setUploadingResume(true);
    setResumeMessage('Uploading and reading your resume…');

    const formData = new FormData();
    formData.append('file', resumeFile);

    try {
      const res = await fetch('/api/my/profile/resume', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResumeMessage(`Done — ${data.keywordsTagged} keyword(s) tagged from your resume.`);
      setResumeFile(null);
      load();
    } catch (err) {
      setResumeMessage((err as Error).message);
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleBulkUpload() {
    if (bulkFiles.length === 0) return;
    setBulkUploading(true);
    setBulkResults(null);

    const formData = new FormData();
    bulkFiles.forEach((f) => formData.append('files', f));

    try {
      const res = await fetch('/api/my/bulk-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setBulkResults(data.results || []);
        setBulkFiles([]);
        load();
      } else {
        setBulkResults([{ fileName: '', type: 'error', message: data.error || 'Upload failed' }]);
      }
    } catch (err) {
      setBulkResults([{ fileName: '', type: 'error', message: (err as Error).message }]);
    } finally {
      setBulkUploading(false);
    }
  }

  if (!profile) {
    return (
      <div>
        <NavBar />
        <p className="p-8 text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="My Profile" subtitle={`${profile.firstName} ${profile.lastName}`} />
      <main className="mx-auto max-w-lg space-y-6 px-6 py-8">
        {/* Availability */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Availability</h2>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setWorkingStatus('AVAILABLE')}
              className={clsx(
                'flex-1 rounded-lg border px-4 py-2 text-sm font-medium',
                workingStatus === 'AVAILABLE'
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-300 text-slate-600'
              )}
            >
              Available
            </button>
            <button
              onClick={() => setWorkingStatus('WORKING')}
              className={clsx(
                'flex-1 rounded-lg border px-4 py-2 text-sm font-medium',
                workingStatus === 'WORKING'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-600'
              )}
            >
              Working
            </button>
          </div>

          {workingStatus === 'WORKING' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Which company are you working for?
              </label>
              <select
                value={currentClientId}
                onChange={(e) => setCurrentClientId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Select a company --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Contact Info</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Email (where notifications go)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Grande Prairie, AB"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Emergency contact */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Emergency Contact</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Name</label>
              <input
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Phone</label>
              <input
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">About Me</h2>
          <p className="mb-3 text-xs text-slate-500">A short bio in your own words.</p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Tell clients a bit about your experience..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
        </button>

        {/* Resume */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Resume</h2>
          <ul className="mb-3 space-y-1 text-sm">
            {profile.resumes.map((r) => (
              <li key={r.id}>
                <a
                  href={`/api/resumes/${r.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  {r.fileName}
                </a>{' '}
                <span className="text-slate-400">— {new Date(r.createdAt).toLocaleDateString('en-CA')}</span>
              </li>
            ))}
            {profile.resumes.length === 0 && <li className="text-slate-400">No resume on file yet.</li>}
          </ul>

          <label className="inline-block cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            {uploadingResume ? 'Processing…' : 'Upload a new resume'}
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                setResumeFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) {
                  setTimeout(handleResumeUpload, 0);
                }
              }}
              disabled={uploadingResume}
            />
          </label>
          {resumeMessage && <p className="mt-2 text-xs text-slate-500">{resumeMessage}</p>}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Upload Multiple Files</h3>
            <p className="mb-2 text-xs text-slate-500">
              Select several files at once (an updated resume plus certification photos, your
              driver's license, etc.) — it automatically figures out which is which.
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
              className="text-sm"
            />
            {bulkFiles.length > 0 && <p className="mt-1 text-xs text-slate-500">{bulkFiles.length} file(s) selected</p>}
            <div>
              <button
                onClick={handleBulkUpload}
                disabled={bulkFiles.length === 0 || bulkUploading}
                className="mt-2 rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
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
                      r.type === 'error' ? 'text-red-700' : r.type === 'skipped' ? 'text-slate-400' : 'text-slate-600'
                    }
                  >
                    <span className="font-medium">{r.fileName}</span>: {r.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* My Evaluations */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">My Evaluations</h2>
          <p className="mb-3 text-xs text-slate-500">Your scores from client evaluations. Written feedback is reviewed internally by staff.</p>
          {profile.evaluations.length === 0 ? (
            <p className="text-sm text-slate-400">No evaluations submitted yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {profile.evaluations.map((e) => (
                <li key={e.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">Overall: {e.overallScore}/5</span>
                    {e.evaluatorCompany && <span className="text-xs text-slate-400">{e.evaluatorCompany}</span>}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>Safety: {e.safetyScore}/5</span>
                    <span>Knowledge: {e.knowledgeScore}/5</span>
                    <span>Reporting: {e.reportingScore}/5</span>
                    <span>Professionalism: {e.professionalismScore}/5</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{new Date(e.createdAt).toLocaleDateString('en-CA')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}