// ESLint flat config for mobile (Expo, React Native, TypeScript)
// Expo ยังปล่อย shareable config แบบ legacy อยู่ จึงต้อง bridge ผ่าน FlatCompat
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  globalIgnores([
    'node_modules/**',
    '.expo/**',
    'dist/**',
    'assets/**',
    'babel.config.js',
    'metro.config.cjs',
    'tailwind.config.cjs',
    '*.config.js',
    '__tests__/jest.setup.ts',
    'expo-env.d.ts',
  ]),
  ...compat.config({
    extends: ['expo', 'prettier'],
    plugins: ['prettier', 'unused-imports', '@typescript-eslint'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': ['error', { singleQuote: true }],
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'import/no-unresolved': 'off',
      // กฎ React Compiler จาก Expo SDK 55 ยังไม่เปิดใช้กับ codebase นี้
      // เพราะ Reanimated shared values และ effect-driven screens ต้อง migration แยก
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    overrides: [
      {
        files: ['*.config.js', '*.config.cjs', 'babel.config.js', 'metro.config.js'],
        parser: 'espree',
        env: {
          node: true,
        },
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
        },
      },
    ],
  }),
]);
