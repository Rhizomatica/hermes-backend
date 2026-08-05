import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'drizzle.config.ts', 'vitest.config.ts'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      'no-console': 'warn',
    },
  },
  // Rules for repository files — better-sqlite3 is synchronous,
  // but we keep async signatures for future adapter swaps (e.g. PostgreSQL).
  {
    files: ['src/db/repositories/**/*.ts'],
    rules: {
      // better-sqlite3 methods (.get, .all, .run) are sync; await is harmless
      '@typescript-eslint/await-thenable': 'off',
      // Repository methods return Promise<T> for adapter abstraction but may
      // have no async I/O internally with better-sqlite3
      '@typescript-eslint/require-await': 'off',
    },
  },
  // Disable require-await for Fastify plugins and hooks — decorators and
  // route registration are sync wrappers that may not contain await.
  {
    files: ['src/app.ts', 'src/auth/middleware/**/*.ts', 'src/api/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      // Fastify v5 supports async hooks but its TS types still declare void return
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  // better-sqlite3's healthCheck uses PRAGMA which is sync
  {
    files: ['src/db/sqlite.adapter.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
);
