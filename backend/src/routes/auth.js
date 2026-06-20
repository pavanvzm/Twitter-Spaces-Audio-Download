/**
 * Authentication Routes - OAuth 2.0 PKCE Implementation
 * 
 * Implements the official X OAuth 2.0 flow with PKCE (Proof Key for Code Exchange).
 * This is the same flow used by X's official apps and ensures secure authentication
 * without exposing client secrets in frontend code.
 */

import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { validateToken, revokeToken, getUserProfile } from '../services/twitter.js';
import { createSession, getSession, getSessionByToken, deleteSession, updateSessionTokens } from '../services/session.js';
import { generateStateToken, verifyStateToken } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

const X_AUTH_BASE = 'https://twitter.com/i/oauth2';
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback';

// Required scopes for Space access
const SCOPES = [
  'tweet.read',
  'users.read',
  'offline.access',
].join(' ');

/**
 * Generate PKCE parameters
 * RFC 7636 - Proof Key for Code Exchange
 */
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * GET /api/auth/login
 * Initiates OAuth 2.0 PKCE flow
 * Returns authorization URL for frontend redirect
 */
router.get('/login', authLimiter, async (req, res) => {
  try {
    const state = generateStateToken();
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Store state and verifier in session (server-side)
    const sessionId = uuidv4();
    await createSession(sessionId, {
      state,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.X_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${X_AUTH_BASE}/authorize?${params.toString()}`;
    
    logger.info(`OAuth login initiated. Session: ${sessionId.substring(0, 8)}...`);
    
    res.json({
      success: true,
      authUrl,
      sessionId, // Frontend stores this to match callback
    });
  } catch (error) {
    logger.error('OAuth login error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate login',
      code: 'AUTH_INIT_FAILED'
    });
  }
});

/**
 * POST /api/auth/callback
 * Exchange authorization code for tokens
 * Called by frontend after X redirects back
 */
router.post('/callback', authLimiter, async (req, res) => {
  try {
    const { code, state, sessionId } = req.body;

    if (!code || !state || !sessionId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        code: 'INVALID_CALLBACK'
      });
    }

    // Verify state token to prevent CSRF
    const storedSession = await getSession(sessionId);
    if (!storedSession || storedSession.state !== state) {
      return res.status(400).json({
        error: 'Invalid state token. Possible CSRF attack.',
        code: 'STATE_MISMATCH'
      });
    }

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code, storedSession.codeVerifier);
    
    if (!tokenResponse.access_token) {
      throw new Error('Token exchange failed');
    }

    // Fetch user profile with the new access token
    const userProfile = await getUserProfile(tokenResponse.access_token);

    // Update session with tokens
    await updateSessionTokens(sessionId, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      userId: userProfile.id,
      username: userProfile.username,
    });

    // Generate our own session token for the client
    const clientToken = generateStateToken();
    
    logger.info(`OAuth callback successful. User: @${userProfile.username}`);

    // Set HttpOnly cookie for web clients
    res.cookie('x_session', clientToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        avatarUrl: userProfile.profile_image_url,
      },
      expiresAt: tokenResponse.expires_in,
    });
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
      details: error.message
    });
  }
});

/**
 * Exchange authorization code for access tokens
 * Uses X's token endpoint directly
 */
async function exchangeCodeForTokens(code, codeVerifier) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.X_CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req, res) => {
  try {
    const sessionToken = req.cookies?.x_session || req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const session = await getSessionByToken(sessionToken);
    
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    const userProfile = await getUserProfile(session.accessToken);

    res.json({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        avatarUrl: userProfile.profile_image_url,
      },
      authenticated: true,
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      code: 'USER_FETCH_FAILED'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const sessionToken = req.cookies?.x_session || req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({
        error: 'No session found',
        code: 'NO_SESSION'
      });
    }

    const session = await getSessionByToken(sessionToken);
    
    if (!session?.refreshToken) {
      return res.status(401).json({
        error: 'No refresh token available',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Exchange refresh token for new access token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.X_CLIENT_ID,
      refresh_token: session.refreshToken,
    });

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenResponse = await response.json();

    // Update session
    await updateSessionTokens(session.id, {
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    });

    res.json({
      success: true,
      expiresAt: tokenResponse.expires_in,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and revoke tokens
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.cookies?.x_session || req.headers['x-session-token'];
    
    if (sessionToken) {
      const session = await getSessionByToken(sessionToken);
      if (session?.accessToken) {
        // Revoke token with X
        await revokeToken(session.accessToken);
      }
      
      // Delete our session
      await deleteSession(session.id);
    }

    // Clear cookie
    res.clearCookie('x_session');

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    // Still return success - logout should always work
    res.json({ success: true });
  }
});

export default router;
