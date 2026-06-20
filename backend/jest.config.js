/**
 * Jest Configuration for X Spaces Audio Downloader Backend Tests
 */

export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {},
  injectGlobals: true,
};
