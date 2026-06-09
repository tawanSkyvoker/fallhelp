/**
 * Jest Configuration — Integration Tests
 *
 * Runs in ESM mode (--experimental-vm-modules) so that:
 *   - Prisma 7's `import.meta.url` works natively
 *   - ESM-only packages (uuid, express-rate-limit, etc.) load correctly
 *
 * Usage:
 *   NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.integration.config.cjs
 *   (or just: npm run test:integration)
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  verbose: true,
  testTimeout: 60000,
  clearMocks: true,
  forceExit: true,
  detectOpenHandles: false,
  // setupFiles runs BEFORE test files are imported — sets DATABASE_URL to test DB
  setupFiles: ['<rootDir>/src/__tests__/integration/env-setup.ts'],
  // setupFilesAfterEnv runs after test framework is ready — jest globals available
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
};
