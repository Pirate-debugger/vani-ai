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
    const pool = new Pool({ connectionString: dbUrl });
    adapter = new PrismaPg(pool);
  } catch (err) {
    console.error('[Prisma] Failed to initialize PostgreSQL adapter:', err);
    throw err;
  }
} else {
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  let url = dbUrl;
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      try {
        const templateDbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
        if (fs.existsSync(templateDbPath)) {
          fs.copyFileSync(templateDbPath, tmpDbPath);
          fs.chmodSync(tmpDbPath, 0o666);
        } else {
          fs.writeFileSync(tmpDbPath, '');
        }
      } catch (err) {
        console.error('Failed to copy SQLite database to /tmp:', err);
      }
    }
    url = `file:${tmpDbPath}`;
  } else {
    if (!url.startsWith('file:')) {
      url = `file:${url}`;
    }
  }
  adapter = new PrismaBetterSqlite3({ url });
}

const prisma = new PrismaClient(adapter ? { adapter } : undefined);

export default prisma;
