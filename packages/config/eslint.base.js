// Shared ESLint flat config for the monorepo's TypeScript packages.
// Apps can extend this by spreading it into their own flat config array.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/android/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
