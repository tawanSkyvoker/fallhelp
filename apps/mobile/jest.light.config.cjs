module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/utils/**/*.test.[jt]s?(x)',
    '<rootDir>/__tests__/app/(auth)/login.test.tsx',
    '<rootDir>/__tests__/app/(auth)/register.test.tsx',
    '<rootDir>/__tests__/app/(setup)/step1-elder-info.test.tsx',
    '<rootDir>/__tests__/app/(tabs)/dashboard.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react$': '<rootDir>/../../node_modules/react',
    '^react/(.*)$': '<rootDir>/../../node_modules/react/$1',
    '^react-test-renderer$': '<rootDir>/../../node_modules/react-test-renderer',
    '^react-test-renderer/(.*)$': '<rootDir>/../../node_modules/react-test-renderer/$1',
  },
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/__tests__/jest.setup.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|expo-modules-core|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-css-interop|nativewind)/)',
  ],
};
