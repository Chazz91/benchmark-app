import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';
import DashboardChatPreview from '@/components/DashboardChatPreview';

function StatIcon({ path }: { path: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-gold-400">
        <path d={path} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const ICONS = {
  people: 'M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm8 13v-1a3 3 0 0 0-2-2.83M16 3.13a4 4 0 0 1 0 7.75',
  check: 'M8 12.5l2.5 2.5L16 9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  pause: 'M8 4h3v16H8V4Zm5 0h3v16h-3V4Z',
  inbox: 'M3 9l2-5h14l2 5M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M3 9h5l1.5 3h5L16 9h5',
  clock: 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  star: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19.3l1.3-6-4.6-4.1 6.1-.6L12 3Z',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user.role === 'CONSULTANT') redirect('/my-tickets');

  const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [totalConsultants, activeConsultants, benchCount, pendingApplications, expiringTickets, evalAgg] =
    await Promise.all([
      prisma.consultant.count(),
      prisma.consultant.count({ where: { status: 'ACTIVE' } }),
      prisma.consultant.count({ where: { status: 'BENCH' } }),
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.ticket.count({ where: { expiryDate: { lte: sixtyDaysFromNow } } }),
      prisma.evaluation.aggregate({ _avg: { overallScore: true }, _count: true }),
    ]);

  const stats = [
    { label: 'Total Consultants', value: totalConsultants, href: '/consultants', icon: ICONS.people },
    { label: 'Active', value: activeConsultants, href: '/consultants', icon: ICONS.check },
    { label: 'On Bench', value: benchCount, href: '/consultants', icon: ICONS.pause },
    { label: 'Pending Applications', value: pendingApplications, href: '/admin/applications', icon: ICONS.inbox },
    { label: 'Tickets Expiring Soon', value: expiringTickets, href: '/consultants', icon: ICONS.clock },
    {
      label: 'Avg Evaluation Score',
      value: evalAgg._count > 0 ? evalAgg._avg.overallScore?.toFixed(1) : '—',
      href: '/admin/evaluations',
      icon: ICONS.star,
    },
  ];

  return (
    <div>
      <NavBar />
      <PageHeader title="Dashboard" subtitle="A quick look at where things stand today." />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="absolute left-0 top-0 h-full w-1 bg-gold-500 opacity-0 transition-opacity group-hover:opacity-100" />
              <StatIcon path={s.icon} />
              <p className="mt-3 text-sm font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-900">{s.value}</p>
            </a>
          ))}
        </div>
        <DashboardChatPreview />
      </main>
    </div>
  );
}