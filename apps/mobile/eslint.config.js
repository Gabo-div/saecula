// ESLint flat config for the mobile app, extending the shared monorepo base.
import base from '@saecula/config/eslint.base';

export default [
  ...base,
  {
    // Node/CommonJS build-config files (Metro, Babel) use require/module and are
    // not part of the app's TS source.
    files: ['**/*.config.js', 'babel.config.js', 'metro.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly', process: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
