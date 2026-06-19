/**
 * Cryptographic Utilities
 * 
 * Security-focused helpers for token generation and validation.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 */
export function generateStateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate PKCE code verifier (RFC 7636)
 * Must be between 43-128 characters from [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
export function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

/**
 * Generate PKCE code challenge (S256 method)
 */
export function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Verify a state token hasn't expired
 */
export function verifyStateToken(token, maxAge = 10 * 60 * 1000) {
  if (!token || typeof token !== 'object') {
    return false;
  }
  
  const { value, timestamp } = token;
  
  if (!value || !timestamp) {
    return false;
  }
  
  return Date.now() - timestamp < maxAge;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(text, secretKey) {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(encryptedData, secretKey) {
  const { iv, encrypted, authTag } = encryptedData;
  
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash a string using SHA-256
 */
export function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  if (bufA.length !== bufB.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}
