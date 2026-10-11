import app from '../backend/server.js';

/**
 * Vercel Serverless Function entrypoint
 * Directly mounts and handles Express application requests
 */
export default function handler(req, res) {
  return app(req, res);
}
