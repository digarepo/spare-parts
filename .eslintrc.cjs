/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: { es2023: true, node: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import', 'promise', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:promise/recommended',
    'plugin:prettier/recommended',
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        // Let the resolver pick up per-package tsconfigs as well
        project: [
          './tsconfig.base.json',
          './apps/api/tsconfig.json',
          './apps/web/tsconfig.json',
          './packages/db/tsconfig.json',
          './packages/contracts/tsconfig.json',
        ],
      },
    },
  },
  // 👇 Key part: per-workspace program for type-aware rules
  overrides: [
    {
      files: ['apps/api/**/*.{ts,tsx}'],
      parserOptions: {
        project: ['./apps/api/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    {
      files: ['packages/db/**/*.{ts,tsx}'],
      parserOptions: {
        project: ['./packages/db/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    {
      files: ['packages/contracts/**/*.{ts,tsx}'],
      parserOptions: {
        project: ['./packages/contracts/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      parserOptions: {
        project: ['./apps/web/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
  ],
  rules: {
    'import/order': [
      'warn',
      { alphabetize: { order: 'asc', caseInsensitive: true }, 'newlines-between': 'always' },
    ],
    'unused-imports/no-unused-imports': 'warn',
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
  },
  ignorePatterns: [
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.vite/**',
    '**/coverage/**',
    '**/*.config.*',
    '**/node_modules/**',
  ],
};
