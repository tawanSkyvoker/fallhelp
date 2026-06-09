// ESLint flat config for backend (TypeScript, Node.js)
// See: https://eslint.org/docs/latest/use/configure/configuration-files-new
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * Note: Do not use `satisfies FlatConfig[]` for compatibility with Node.js ESM loader.
 */

export default defineConfig([
  globalIgnores([
    'dist/**',
    'node_modules/**',
    'coverage/**',
    'src/generated/**',
    '*.config.js',
    '*.config.cjs',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*', '~/*', 'src/*'],
              message:
                'backend ยังไม่รองรับ alias import แบบ runtime-safe ใน dev/build/test/start; ใช้ relative imports หรือ package-local paths ที่มีอยู่จริงเท่านั้น',
            },
          ],
        },
      ],
    },
    ignores: ['**/*.test.ts', '**/__tests__/**'],
  },
]);
