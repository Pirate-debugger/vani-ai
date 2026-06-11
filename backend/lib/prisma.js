import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the database file path from DATABASE_URL env var
function resolveDbUrl() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  // If it's already a file: URL, return as-is
  if (url.startsWith('file:')) return url;
  // Otherwise prefix it
  return `file:${url}`;
}

// The adapter expects { url: 'file:./path/to/db' }
const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });

const prisma = new PrismaClient({ adapter });

export default prisma;
