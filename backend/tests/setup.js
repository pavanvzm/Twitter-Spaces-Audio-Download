/**
 * Test Setup - Global mocks and configuration
 */

import { vi } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.X_BEARER_TOKEN = 'test_bearer_token_for_mocking';
process.env.X_CLIENT_ID = 'test_client_id';
process.env.X_CLIENT_SECRET = 'test_client_secret';
process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/auth/callback';
process.env.PORT = '3001';

// Global logger mock
vi.mock('./src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
