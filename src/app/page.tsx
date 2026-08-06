import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import PublicNav from '@/components/PublicNav';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(session.user.role === 'CONSULTANT' ? '/my-tickets' : '/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-900 via-brand-800 to-brand-600 px-6 py-20 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/5 px-4 py-1.5 text-sm font-medium text-gold-300">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          Western Canadian Oil &amp; Gas Staffing
        </span>
        <h1 className="mx-auto max-w-3xl font-heading text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          Engineered Solutions, <span className="text-gold-400">Built on Experience</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Benchmark Engineering connects experienced drilling and completions consultants with
          operators across Alberta, BC, and Saskatchewan &mdash; backed by a rigorous approach to
          certification tracking, safety compliance, and client evaluation.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/apply"
            className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-brand-900 hover:bg-gold-600"
          >
            Submit Your Resume
          </Link>
          <a
            href="mailto:chase@benchmarkeng.ca"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Looking to Hire? Get in Touch
          </a>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-heading text-lg font-bold text-brand-900">Vetted Consultants</h2>
            <p className="text-sm text-slate-600">
              Every consultant is reviewed and matched by formation, rig type, skillset, and
              discipline &mdash; drilling, completions, and lease construction.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-heading text-lg font-bold text-brand-900">Certification Tracking</h2>
            <p className="text-sm text-slate-600">
              H2S Alive, Well Control, WHMIS, and every core ticket your site requires &mdash; kept
              current with automatic renewal reminders.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-heading text-lg font-bold text-brand-900">Client Evaluations</h2>
            <p className="text-sm text-slate-600">
              Structured, consistent feedback on every placement &mdash; safety awareness,
              professionalism, and technical performance.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p>Benchmark Engineering Inc.</p>
        <p>Suite 810, 396 - 11th Ave S.W. Calgary, AB T2R 0C5</p>
        <p>Phone (403) 266-5757 &middot; Fax (403) 266-5730</p>
      </footer>
    </div>
  );
}

