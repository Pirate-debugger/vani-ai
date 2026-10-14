import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || process.env.DATABASE_PROVIDER === 'postgresql';

let adapter = null;

if (isPostgres) {
  try {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const pg = await import('pg');
    const Pool = pg.default?.Pool || pg.Pool;
    const pool = new Pool({
      connectionString: dbUrl,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    adapter = new PrismaPg(pool);
  } catch (err) {
    console.error('[Prisma] Failed to initialize PostgreSQL adapter:', err);
    throw err;
  }
} else {
  let url = dbUrl;
  try {
    const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
    if (process.env.VERCEL) {
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_EPHEMERAL_DB !== 'true') {
        throw new Error(
          'Production deployment on Vercel requires a durable PostgreSQL database. ' +
          'Configure DATABASE_URL to a hosted PostgreSQL instance (e.g. Supabase, Neon, RDS). ' +
          'Silent fallback to ephemeral /tmp SQLite is prohibited in production to prevent data loss.'
        );
      }
      const tmpDbPath = '/tmp/dev.db';
      if (!fs.existsSync(tmpDbPath)) {
        try {
          const templateDbPath = path.join(__dirname, '..', 'prisma', 'template.db');
          const devDbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
          const sourceDb = fs.existsSync(templateDbPath) ? templateDbPath : (fs.existsSync(devDbPath) ? devDbPath : null);
          if (sourceDb) {
            fs.copyFileSync(sourceDb, tmpDbPath);
            fs.chmodSync(tmpDbPath, 0o666);
          } else {
            fs.writeFileSync(tmpDbPath, '');
          }
        } catch (err) {
          console.error('[Prisma] Failed to copy SQLite database to /tmp:', err);
        }
      }
      url = `file:${tmpDbPath}`;
    } else {
      // Resolve relative file paths to absolute path inside backend/prisma
      if (url.startsWith('file:./') || url.startsWith('file:prisma/') || url.includes('/prisma/') || url.includes('\\prisma\\')) {
        const cleanPath = url.replace(/^file:/, '');
        const filename = path.basename(cleanPath) || 'dev.db';
        const resolvedPath = path.resolve(__dirname, '..', 'prisma', filename);
        url = `file:${resolvedPath}`;
      } else if (!url.startsWith('file:') && !url.startsWith('/')) {
        const resolvedPath = path.resolve(__dirname, '..', 'prisma', path.basename(url) || 'dev.db');
        url = `file:${resolvedPath}`;
      }
    }
    adapter = new PrismaBetterSqlite3({ url });
  } catch (sqliteErr) {
    console.warn('[Prisma] SQLite adapter fallback (standard client will be used):', sqliteErr.message);
    adapter = null;
  }
}

// Cache client on globalThis to prevent connection leaks across serverless/HMR invocations
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__prisma ?? new PrismaClient(adapter ? { adapter } : undefined);

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
