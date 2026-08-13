import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        twoFactorCode: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.twoFactorCode) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        // Require a valid, unused, unexpired 2FA code that was just emailed to this user -
        // this is checked here (not just in a separate "verify" step) so there's no way to
        // bypass 2FA even by calling this sign-in flow directly with a correct password.
        const twoFactorRecord = await prisma.twoFactorCode.findFirst({
          where: {
            userId: user.id,
            code: credentials.twoFactorCode,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!twoFactorRecord) return null;

        await prisma.twoFactorCode.update({
          where: { id: twoFactorRecord.id },
          data: { usedAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = (user as { id: string }).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};

// Small helper for server components/route handlers to enforce role checks
export const ROLE_RANK: Record<string, number> = {
  VIEWER: 0,
  CLIENT: 0,
  CONSULTANT: 0,
  RECRUITER: 1,
  ADMIN: 2,
};

export function hasRole(userRole: string | undefined, minRole: keyof typeof ROLE_RANK) {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}