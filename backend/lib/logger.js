import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'password',
      'passwordHash',
      'encryptedKey',
      'apiKey',
      'sarvamKey',
      'openaiKey',
      'geminiKey',
      'tinyfishKey',
      'secret',
      'token',
      'creditCard'
    ],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export default logger;
