'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setValid(d.valid))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 2500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {checking ? (
          <p className="text-center text-sm text-slate-500">Checking your link…</p>
        ) : !valid ? (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold text-red-700">Link expired or invalid</h1>
            <p className="text-sm text-slate-600">
              This password reset link is no longer valid. Please request a new one from the
              login page.
            </p>
          </div>
        ) : done ? (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold text-green-700">Password updated!</h1>
            <p className="text-sm text-slate-600">Taking you to the login page…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h1 className="mb-1 text-center text-lg font-semibold text-brand-900">Set a new password</h1>
            <div>
              <label className="mb-1 block text-xs text-slate-500">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}