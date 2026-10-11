import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
export const CURRENT_KEY_VERSION = 'v1';

const DEFAULT_DEV_KEY = '1234567890123456789012345678901234567890123456789012345678901234';

/**
 * Resolves encryption key based on version or defaults to ENCRYPTION_KEY.
 * Expects a 32-byte hex string (64 characters).
 */
const getEncryptionKey = (version = CURRENT_KEY_VERSION) => {
  const versionedEnvName = `ENCRYPTION_KEY_${version.toUpperCase()}`;
  let keyHex = process.env[versionedEnvName] || process.env.ENCRYPTION_KEY;

  if (!keyHex || keyHex.length !== 64) {
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      throw new Error(`ENCRYPTION_KEY (or ${versionedEnvName}) must be a 64-character hex string (32 bytes).`);
    }
    console.warn(`[Crypto] ${versionedEnvName} not set or invalid (expected 64 hex characters). Using fallback key.`);
    keyHex = DEFAULT_DEV_KEY;
  }
  return Buffer.from(keyHex, 'hex');
};

/**
 * Encrypts a plaintext string using AES-256-GCM with key version prefix:
 * Format: v1:<ivHex>:<encryptedHex>:<authTagHex>
 */
export const encryptKey = (text, version = CURRENT_KEY_VERSION) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(version), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${version}:${iv.toString('hex')}:${encrypted}:${authTag}`;
};

/**
 * Decrypts an AES-256-GCM ciphertext string with version-aware parsing.
 * Supports both versioned ('v1:iv:cipher:tag') and legacy unversioned ('iv:cipher:tag').
 */
export const decryptKey = (encText) => {
  if (!encText) return encText;
  const parts = encText.split(':');

  let version = CURRENT_KEY_VERSION;
  let ivHex, encryptedHex, authTagHex;

  if (parts.length === 4) {
    [version, ivHex, encryptedHex, authTagHex] = parts;
  } else if (parts.length === 3) {
    // Legacy unversioned format
    [ivHex, encryptedHex, authTagHex] = parts;
  } else {
    throw new Error('Invalid encrypted text format.');
  }
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(version),
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
