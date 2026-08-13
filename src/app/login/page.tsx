'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

type Step = 'credentials' | 'code' | 'forgot' | 'forgot-sent';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Step 1: validate the password and trigger a 2FA code email, without creating a session
    const res = await fetch('/api/auth/2fa-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      return;
    }

    // Always move to the code step, regardless of whether credentials were actually valid -
    // this avoids revealing whether an email/password combination exists.
    setStep('code');
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      twoFactorCode: code,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid code, or your email/password was incorrect. Please try again from the start.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setLoading(false);
    setStep('forgot-sent');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-900 via-brand-800 to-brand-700 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <Logo showTagline size="lg" />
        </div>

        {step === 'credentials' && (
          <>
            <p className="mb-6 text-center text-sm text-slate-500">Sign in to your account</p>
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                  placeholder="you@benchmarkeng.ca"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
              >
                {loading ? 'Sending code…' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setStep('forgot');
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-brand-700 hover:underline"
              >
                Forgot your password?
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="mb-1 text-center text-sm font-medium text-slate-700">Check your email</p>
            <p className="mb-6 text-center text-xs text-slate-500">
              We sent a 6-digit verification code to {email}. Enter it below to finish signing in.
            </p>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                  placeholder="000000"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setCode('');
                  setError('');
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-brand-700 hover:underline"
              >
                ← Back
              </button>
            </form>
          </>
        )}

        {step === 'forgot' && (
          <>
            <p className="mb-1 text-center text-sm font-medium text-slate-700">Reset your password</p>
            <p className="mb-6 text-center text-xs text-slate-500">
              Enter your email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-full text-center text-xs text-slate-500 hover:text-brand-700 hover:underline"
              >
                ← Back to sign in
              </button>
            </form>
          </>
        )}

        {step === 'forgot-sent' && (
          <div className="text-center">
            <p className="mb-2 text-sm font-medium text-green-700">Check your email</p>
            <p className="mb-6 text-sm text-slate-600">
              If an account with that email exists, a password reset link is on its way.
            </p>
            <button
              onClick={() => setStep('credentials')}
              className="text-sm text-brand-700 hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}