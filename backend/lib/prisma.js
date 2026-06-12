import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the database file path from DATABASE_URL env var
function resolveDbUrl() {
  let url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  
  // Vercel serverless environment writeable sqlite workaround
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      try {
        const templateDbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
        console.log(`[SQLite Workaround] Checking database template at: ${templateDbPath}`);
        if (fs.existsSync(templateDbPath)) {
          console.log(`[SQLite Workaround] Template found! Copying to ${tmpDbPath}`);
          fs.copyFileSync(templateDbPath, tmpDbPath);
          fs.chmodSync(tmpDbPath, 0o666);
        } else {
          console.warn(`[SQLite Workaround] Template NOT found! Creating empty SQLite file at ${tmpDbPath}`);
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
  return url;
}

// The adapter expects { url: 'file:./path/to/db' }
const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });

const prisma = new PrismaClient({ adapter });

export default prisma;
