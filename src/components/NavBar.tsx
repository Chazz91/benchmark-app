'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import clsx from 'clsx';
import Logo from './Logo';

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const internalLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/consultants', label: 'Consultants' },
    { href: '/admin/applications', label: 'Applications' },
    { href: '/admin/evaluations', label: 'Evaluations' },
    { href: '/team-chat', label: 'Team Chat' },
  ];

  const consultantLinks = [
    { href: '/my-tickets', label: 'My Tickets' },
    { href: '/my-profile', label: 'My Profile' },
  ];

  const links = role === 'CONSULTANT' ? consultantLinks : internalLinks;

  const linkClass = (href: string) =>
    clsx(
      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
      pathname?.startsWith(href)
        ? 'bg-gold-500 text-brand-900'
        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
    );

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex flex-wrap gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
            {role === 'ADMIN' && (
              <>
                <Link href="/admin/import" className={linkClass('/admin/import')}>
                  Import
                </Link>
                <Link href="/admin/ticket-types" className={linkClass('/admin/ticket-types')}>
                  Ticket Types
                </Link>
                <Link href="/admin/clients" className={linkClass('/admin/clients')}>
                  Clients
                </Link>
                <Link href="/admin/users" className={linkClass('/admin/users')}>
                  Users
                </Link>
              </>
            )}
            {session?.user?.email === 'chase@benchmarkeng.ca' && (
              <Link href="/health-check" className={linkClass('/health-check')}>
                Health Check
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="hidden sm:inline">{session?.user?.name}</span>
          <Link href="/add-to-phone" className="hidden text-xs text-slate-500 hover:text-brand-700 sm:inline">
            📱 Add to phone
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-full border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

