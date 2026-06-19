/**
 * Session Service
 * 
 * Manages user sessions with secure storage.
 * In production, use Redis for distributed sessions.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// In-memory session store (replace with Redis in production)
const sessions = new Map();
const tokenToSessionId = new Map();

// Session configuration
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Create a new session
 */
export async function createSession(id, data) {
  const session = {
    id,
    ...data,
    createdAt: Date.now(),
    lastActive: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };

  sessions.set(id, session);
  logger.info(`Session created: ${id.substring(0, 8)}...`);

  return session;
}

/**
 * Get session by ID
 */
export async function getSession(id) {
  const session = sessions.get(id);

  if (!session) {
    return null;
  }

  // Check expiration
  if (session.expiresAt < Date.now()) {
    await deleteSession(id);
    return null;
  }

  // Update last active
  session.lastActive = Date.now();

  return session;
}

/**
 * Get session by client token
 */
export async function getSessionByToken(token) {
  const sessionId = tokenToSessionId.get(token);
  
  if (!sessionId) {
    return null;
  }

  return getSession(sessionId);
}

/**
 * Update session with new tokens
 */
export async function updateSessionTokens(sessionId, tokens) {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Store access token mapping
  if (tokens.accessToken) {
    session.accessToken = tokens.accessToken;
    session.expiresAt = tokens.expiresAt || (Date.now() + 2 * 60 * 60 * 1000);
    
    // Map token to session
    tokenToSessionId.set(tokens.accessToken, sessionId);
  }

  if (tokens.refreshToken) {
    session.refreshToken = tokens.refreshToken;
  }

  if (tokens.userId) {
    session.userId = tokens.userId;
  }

  if (tokens.username) {
    session.username = tokens.username;
  }

  session.lastActive = Date.now();

  return session;
}

/**
 * Delete a session
 */
export async function deleteSession(id) {
  const session = sessions.get(id);

  if (session) {
    // Remove token mappings
    if (session.accessToken) {
      tokenToSessionId.delete(session.accessToken);
    }
    if (session.refreshToken) {
      tokenToSessionId.delete(session.refreshToken);
    }

    sessions.delete(id);
    logger.info(`Session deleted: ${id.substring(0, 8)}...`);
  }
}

/**
 * Delete session by token
 */
export async function deleteSessionByToken(token) {
  const sessionId = tokenToSessionId.get(token);
  
  if (sessionId) {
    return deleteSession(sessionId);
  }

  return false;
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      if (session.accessToken) {
        tokenToSessionId.delete(session.accessToken);
      }
      sessions.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired sessions`);
  }
}

// Start cleanup interval
setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);

/**
 * Get session count
 */
export function getSessionCount() {
  return sessions.size;
}

/**
 * Check if user has valid session
 */
export async function hasValidSession(token) {
  const session = await getSessionByToken(token);
  return session !== null && session.accessToken !== undefined;
}
