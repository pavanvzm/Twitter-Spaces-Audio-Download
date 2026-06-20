/**
 * Scenario 1: OAuth Login Flow (PKCE Verification)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/services/twitter.js', () => ({
  default: {
    validateToken: vi.fn().mockResolvedValue(true),
    revokeToken: vi.fn().mockResolvedValue(true),
    getUserProfile: vi.fn().mockResolvedValue({
      id: '123456789',
      name: 'Test User',
      username: 'testuser',
      avatarUrl: 'https://pbs.twimg.com/profile_images/test.jpg',
    }),
  },
  validateToken: vi.fn().mockResolvedValue(true),
  revokeToken: vi.fn().mockResolvedValue(true),
  getUserProfile: vi.fn().mockResolvedValue({
    id: '123456789',
    name: 'Test User',
    username: 'testuser',
    avatarUrl: 'https://pbs.twimg.com/profile_images/test.jpg',
  }),
}));

vi.mock('../../src/services/session.js', () => ({
  default: {},
  createSession: vi.fn().mockResolvedValue({}),
  getSession: vi.fn(),
  deleteSession: vi.fn().mockResolvedValue(true),
  updateSessionTokens: vi.fn().mockResolvedValue(true),
  getSessionByToken: vi.fn(),
}));

vi.mock('../../src/utils/crypto.js', () => ({
  default: {},
  generateStateToken: vi.fn().mockReturnValue('test_state_token'),
  verifyStateToken: vi.fn().mockReturnValue(true),
}));

vi.mock('express-rate-limit', () => ({
  __esModule: true,
  default: () => (req, res, next) => next(),
}));

import authRoutes from '../../src/routes/auth.js';

describe('Scenario 1: OAuth Login Flow (PKCE Verification)', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  describe('GET /api/auth/login', () => {
    it('should return 200 with valid authUrl', async () => {
      const response = await request(app)
        .get('/api/auth/login')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('authUrl');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.authUrl).toContain('https://twitter.com/i/oauth2/authorize');
    });

    it('should include PKCE parameters', async () => {
      const response = await request(app)
        .get('/api/auth/login')
        .expect(200);

      const authUrl = new URL(response.body.authUrl);
      
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
      const codeChallenge = authUrl.searchParams.get('code_challenge');
      expect(codeChallenge).toBeTruthy();
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique sessionId', async () => {
      const r1 = await request(app).get('/api/auth/login').expect(200);
      const r2 = await request(app).get('/api/auth/login').expect(200);
      expect(r1.body.sessionId).not.toBe(r2.body.sessionId);
    });

    it('should include required OAuth scopes', async () => {
      const response = await request(app).get('/api/auth/login').expect(200);
      const authUrl = new URL(response.body.authUrl);
      const scope = authUrl.searchParams.get('scope');
      
      expect(scope).toContain('tweet.read');
      expect(scope).toContain('users.read');
      expect(scope).toContain('offline.access');
    });
  });

  describe('PKCE Generation', () => {
    it('should generate valid code verifier', () => {
      const codeVerifier = crypto.randomBytes(64).toString('base64url');
      expect(codeVerifier.length).toBe(86);
    });

    it('should generate correct code challenge', () => {
      const verifier = 'test_verifier';
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge.length).toBe(43);
    });
  });
});
