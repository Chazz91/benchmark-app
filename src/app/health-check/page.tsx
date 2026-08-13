import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

// Only this specific account can view this page - update here if that ever needs to change.
const HEALTH_CHECK_EMAIL = 'chase@benchmarkeng.ca';

function EnvCheck({ label, isSet }: { label: string; isSet: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className={isSet ? 'font-medium text-green-700' : 'font-medium text-red-600'}>
        {isSet ? '✓ Set' : '✗ Missing'}
      </span>
    </div>
  );
}

export default async function HealthCheckPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user.email !== HEALTH_CHECK_EMAIL) redirect('/dashboard');

  const [
    userCount,
    consultantCount,
    pendingApplications,
    ticketCount,
    ticketsExpiringSoon,
    resumeCount,
    teamMessageCount,
    activityLogCount,
    recentActivity,
    systemStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.consultant.count(),
    prisma.application.count({ where: { status: 'PENDING' } }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { expiryDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) } } }),
    prisma.resume.count(),
    prisma.teamMessage.count(),
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    }),
    prisma.systemStatus.findUnique({ where: { id: 'singleton' } }),
  ]);

  const envChecks = [
    { label: 'Database (DATABASE_URL)', isSet: !!process.env.DATABASE_URL },
    { label: 'Claude API (ANTHROPIC_API_KEY)', isSet: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-...' },
    { label: 'Email (RESEND_API_KEY)', isSet: !!process.env.RESEND_API_KEY },
    { label: 'File storage (S3_ACCESS_KEY_ID)', isSet: !!process.env.S3_ACCESS_KEY_ID },
    { label: 'File storage (S3_SECRET_ACCESS_KEY)', isSet: !!process.env.S3_SECRET_ACCESS_KEY },
    { label: 'File storage (S3_BUCKET_NAME)', isSet: !!process.env.S3_BUCKET_NAME },
    { label: 'Cron secret (CRON_SECRET)', isSet: !!process.env.CRON_SECRET },
    { label: 'NextAuth secret (NEXTAUTH_SECRET)', isSet: !!process.env.NEXTAUTH_SECRET },
  ];

  const hoursSinceCron = systemStatus?.lastCronRunAt
    ? Math.round((Date.now() - new Date(systemStatus.lastCronRunAt).getTime()) / (1000 * 60 * 60))
    : null;

  return (
    <div>
      <NavBar />
      <PageHeader title="Health Check" subtitle="Private system status - visible only to your account." />
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Cron status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Daily Ticket-Expiry Cron Job</h2>
          {systemStatus?.lastCronRunAt ? (
            <div>
              <p
                className={
                  hoursSinceCron !== null && hoursSinceCron > 30
                    ? 'text-sm font-medium text-red-600'
                    : 'text-sm font-medium text-green-700'
                }
              >
                Last ran {new Date(systemStatus.lastCronRunAt).toLocaleString('en-CA')}
                {hoursSinceCron !== null && ` (${hoursSinceCron}h ago)`}
              </p>
              {hoursSinceCron !== null && hoursSinceCron > 30 && (
                <p className="mt-1 text-xs text-red-600">
                  This is running less often than expected (should run daily) - worth checking
                  the cron job in your Vercel project settings.
                </p>
              )}
              {systemStatus.lastCronResult && (
                <p className="mt-2 text-xs text-slate-500">Last result: {systemStatus.lastCronResult}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              No record of this ever running yet - expected until this is deployed live with
              Vercel Cron enabled (it won't fire automatically inside a Codespace).
            </p>
          )}
        </div>

        {/* Environment configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Environment Configuration</h2>
          <p className="mb-2 text-xs text-slate-500">
            Confirms each service is configured - does not show any actual secret values.
          </p>
          {envChecks.map((c) => (
            <EnvCheck key={c.label} label={c.label} isSet={c.isSet} />
          ))}
        </div>

        {/* Database snapshot */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Database Snapshot</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Users</p>
              <p className="text-lg font-bold text-brand-900">{userCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Consultants</p>
              <p className="text-lg font-bold text-brand-900">{consultantCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Pending Applications</p>
              <p className="text-lg font-bold text-brand-900">{pendingApplications}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Tickets</p>
              <p className="text-lg font-bold text-brand-900">{ticketCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Expiring Soon</p>
              <p className="text-lg font-bold text-brand-900">{ticketsExpiringSoon}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Resumes on File</p>
              <p className="text-lg font-bold text-brand-900">{resumeCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Team Messages</p>
              <p className="text-lg font-bold text-brand-900">{teamMessageCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Activity Log Entries</p>
              <p className="text-lg font-bold text-brand-900">{activityLogCount}</p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Recent Activity (last 20)</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentActivity.map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-1 text-slate-600 last:border-0">
                  <span className="font-medium text-slate-800">{a.user.name}</span> {a.action.replace(/_/g, ' ').toLowerCase()}
                  {' '}
                  <span className="text-xs text-slate-400">
                    ({a.entityType}) — {new Date(a.createdAt).toLocaleString('en-CA')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}