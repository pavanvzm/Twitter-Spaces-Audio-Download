/**
 * Scenario 2: Space URL Parsing
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('express-rate-limit', () => ({
  __esModule: true,
  default: () => (req, res, next) => next(),
}));

vi.mock('../../src/services/cache.js', () => ({
  default: {},
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/twitter.js', () => ({
  default: {},
  getGuestToken: vi.fn().mockResolvedValue('test_guest_token'),
  fetchSpaceMetadata: vi.fn().mockResolvedValue(null),
}));

import spacesRoutes from '../../src/routes/spaces.js';

describe('Scenario 2: Space URL Parsing', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/spaces', spacesRoutes);
  });

  describe('POST /api/spaces/parse', () => {
    const validUrls = [
      { url: 'https://twitter.com/i/spaces/1RDxlkAORPVJL', expected: '1RDxlkAORPVJL' },
      { url: 'https://x.com/i/spaces/abc123XYZ', expected: 'abc123XYZ' },
      { url: 'https://twitter.com/i/spaces/1', expected: '1' },
    ];

    validUrls.forEach(({ url, expected }) => {
      it(`should parse: ${url}`, async () => {
        const response = await request(app)
          .post('/api/spaces/parse')
          .send({ url })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.spaceId).toBe(expected);
      });
    });

    const invalidUrls = [
      { url: 'https://invalid.com/spaces/123', code: 'INVALID_URL' },
      { url: 'https://twitter.com/status/123/spaces', code: 'INVALID_URL' },
      { url: 'https://twitter.com/notspaces/123', code: 'INVALID_URL' },
    ];

    invalidUrls.forEach(({ url, code }) => {
      it(`should reject: ${url}`, async () => {
        const response = await request(app)
          .post('/api/spaces/parse')
          .send({ url })
          .expect(400);

        expect(response.body.code).toBe(code);
      });
    });

    it('should return 400 for empty URL', async () => {
      const response = await request(app)
        .post('/api/spaces/parse')
        .send({ url: '' })
        .expect(400);

      expect(response.body.code).toBe('URL_REQUIRED');
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app)
        .post('/api/spaces/parse')
        .send({})
        .expect(400);

      expect(response.body.code).toBe('URL_REQUIRED');
    });

    it('should include supported formats in error', async () => {
      const response = await request(app)
        .post('/api/spaces/parse')
        .send({ url: 'invalid' })
        .expect(400);

      expect(response.body.supportedFormats).toBeDefined();
      expect(Array.isArray(response.body.supportedFormats)).toBe(true);
    });

    it('should handle URLs with query params', async () => {
      const response = await request(app)
        .post('/api/spaces/parse')
        .send({ url: 'https://twitter.com/i/spaces/1RDxlkAORPVJL?s=20' })
        .expect(200);

      expect(response.body.spaceId).toBe('1RDxlkAORPVJL');
    });
  });

  describe('URL Regex Logic', () => {
    it('should extract Space ID from direct URL', () => {
      const testCases = [
        { path: '/i/spaces/1RDxlkAORPVJL', expected: '1RDxlkAORPVJL' },
        { path: '/i/spaces/abc123', expected: 'abc123' },
        { path: '/profile/123/spaces/xyz', expected: null },
      ];

      testCases.forEach(({ path, expected }) => {
        const match = path.match(/\/i\/spaces\/([A-Za-z0-9]+)/);
        const result = match ? match[1] : null;
        expect(result).toBe(expected);
      });
    });
  });
});
