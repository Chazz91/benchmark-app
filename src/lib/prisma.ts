import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Node < 22 has no global WebSocket; harmless to set on newer runtimes too.
neonConfig.webSocketConstructor = ws;
// Vercel freezes serverless functions between invocations, so a pooled WebSocket
// connection often gets closed by Neon during the freeze; the next query on a
// reused (warm) container then fails with "Connection terminated unexpectedly".
// Routing plain pool queries over HTTP instead avoids depending on a
// long-lived connection surviving the freeze. Explicit transactions still use
// a real WebSocket-backed client, so this doesn't affect $transaction.
neonConfig.poolQueryViaFetch = true;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaNeon(
  { connectionString: process.env.DATABASE_URL },
  {
    // Neon's pooled connection drops WebSocket connections periodically;
    // without these handlers an unhandled 'error' event on the pool crashes the process.
    onPoolError: (err) => console.error('Neon pool error:', err),
    onConnectionError: (err) => console.error('Neon connection error:', err),
  },
);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
