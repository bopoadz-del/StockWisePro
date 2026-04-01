import crypto from 'crypto';
import { config } from '../config';

const ENCRYPTION_KEY = config.encryption.key || process.env.ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  // Generate salt and derive key
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
  
  // Generate IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + encrypted
  const result = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]).toString('base64');
  
  return result;
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  // Decode from base64
  const data = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  // Derive key
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Hash API key for storage (one-way)
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHmac('sha256', ENCRYPTION_KEY || 'default-secret')
    .update(apiKey)
    .digest('hex');
}

/**
 * Generate secure random API key
 */
export function generateApiKey(): { key: string; prefix: string } {
  const key = crypto.randomBytes(32).toString('hex');
  const prefix = key.substring(0, 8);
  return { key: `ak_${key}`, prefix };
}

/**
 * Generate secure random secret
 */
export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate HMAC signature for webhook verification
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateWebhookSignature(payload, secret);
  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars * 2) + data.substring(data.length - visibleChars);
}

/**
 * Generate secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Hash token for storage
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}
