import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || process.env.DATABASE_PROVIDER === 'postgresql';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', isPostgres ? 'schema.postgresql.prisma' : 'schema.prisma'),
  datasource: {
    url: dbUrl,
  },
  migrations: {
    path: path.join(__dirname, 'prisma', isPostgres ? 'migrations_postgresql' : 'migrations'),
  },
});

