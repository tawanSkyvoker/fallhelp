module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
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
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|expo-modules-core|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-toast-message|@react-navigation|react-native-css-interop|nativewind)/)',
  ],
};
