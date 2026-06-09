/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/integration/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/generated/**',
    '!src/__tests__/**',
    // Bootstrap / entry-point files — run at process start, not testable without live infra
    '!src/server.ts',
    '!src/prisma.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  // Keep default exit behavior so leaked handles fail the test run naturally.
  // Enable explicit handle tracing with: JEST_DETECT_OPEN_HANDLES=true npm test
  detectOpenHandles: process.env.JEST_DETECT_OPEN_HANDLES === 'true',
  openHandlesTimeout: 5000,
  // ts-jest ต้อง strip .js จาก relative imports ที่ถูกเขียนแบบ ESM-compatible
  // backend ยังตั้งใจใช้ relative imports ต่อไปจนกว่าจะมี runtime-safe import strategy กลาง
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^.*/generated/prisma/client$': '<rootDir>/src/__tests__/__mocks__/generatedPrismaClient.ts',
  },
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
