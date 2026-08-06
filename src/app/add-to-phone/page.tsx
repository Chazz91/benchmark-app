import Logo from '@/components/Logo';

export default function AddToPhonePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Logo showTagline />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-2 font-heading text-3xl font-extrabold text-brand-900">
          Add Benchmark Engineering to Your Phone
        </h1>
        <p className="mb-10 text-slate-600">
          Follow the steps for your phone below. Once added, you&apos;ll get a real app icon on
          your home screen &mdash; tap it anytime to check your tickets, update your profile, or
          get back to work, no browser tabs needed.
        </p>

        <div className="grid gap-8 sm:grid-cols-2">
          {/* iPhone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-heading text-xl font-bold text-brand-900">iPhone (Safari)</h2>
            <ol className="space-y-4 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">1</span>
                <span>Open this site in <strong>Safari</strong> (this only works in Safari, not Chrome, on iPhone).</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">2</span>
                <span>
                  Tap the <strong>Share button</strong> at the bottom of the screen (a square with an
                  arrow pointing up).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">3</span>
                <span>
                  Scroll down the menu that pops up and tap <strong>&quot;Add to Home Screen&quot;</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">4</span>
                <span>
                  Tap <strong>&quot;Add&quot;</strong> in the top corner.
                </span>
              </li>
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Done! You&apos;ll see the Benchmark icon on your home screen, right alongside your
              other apps.
            </p>
          </div>

          {/* Android */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-heading text-xl font-bold text-brand-900">Android (Chrome)</h2>
            <ol className="space-y-4 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">1</span>
                <span>Open this site in <strong>Chrome</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">2</span>
                <span>
                  Tap the <strong>three-dot menu</strong> in the top-right corner.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">3</span>
                <span>
                  Tap <strong>&quot;Add to Home screen&quot;</strong> (sometimes shown as &quot;Install app&quot;).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-brand-900">4</span>
                <span>
                  Confirm by tapping <strong>&quot;Add&quot;</strong> or <strong>&quot;Install&quot;</strong>.
                </span>
              </li>
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Done! Android sometimes shows an install prompt automatically &mdash; if you see a
              banner asking to install the app, that works too.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-slate-400">
          Having trouble? Reach out to your admin and they can walk you through it.
        </p>
      </main>
    </div>
  );
}

