'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

export default function PublicNav() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/apply', label: 'Apply' },
  ];

  return (
    <header className="border-b border-white/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? 'rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-brand-900'
                  : 'rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100'
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-full bg-brand-800 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}