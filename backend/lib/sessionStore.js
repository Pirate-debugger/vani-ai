import session from 'express-session';
import prisma from './prisma.js';

/**
 * PrismaSessionStore
 * Fully persistent, zero-external-dependency session store for express-session.
 * Works natively in SQLite (local development) and PostgreSQL (production).
 */
export class PrismaSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttl = options.ttl || 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  }

  async get(sid, callback) {
    try {
      const record = await prisma.session.findUnique({
        where: { sid }
      });
      if (!record) return callback(null, null);
      if (record.expiresAt && record.expiresAt < new Date()) {
        await prisma.session.delete({ where: { sid } }).catch(() => {});
        return callback(null, null);
      }
      const data = JSON.parse(record.data);
      return callback(null, data);
    } catch (err) {
      return callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const expiresAt = sessionData?.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + this.ttl);

      const dataStr = JSON.stringify(sessionData || {});

      await prisma.session.upsert({
        where: { sid },
        update: {
          data: dataStr,
          expiresAt
        },
        create: {
          sid,
          data: dataStr,
          expiresAt
        }
      });
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await prisma.session.deleteMany({
        where: { sid }
      });
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      const expiresAt = sessionData?.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + this.ttl);

      await prisma.session.updateMany({
        where: { sid },
        data: { expiresAt }
      });
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

export default PrismaSessionStore;
