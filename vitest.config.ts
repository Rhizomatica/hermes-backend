import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@db': resolve(__dirname, 'src/db'),
      '@auth': resolve(__dirname, 'src/auth'),
      '@api': resolve(__dirname, 'src/api'),
      '@hal': resolve(__dirname, 'src/hal'),
      '@messaging': resolve(__dirname, 'src/messaging'),
      '@events': resolve(__dirname, 'src/events'),
      '@jobs': resolve(__dirname, 'src/jobs'),
      '@clock': resolve(__dirname, 'src/clock'),
      '@resilience': resolve(__dirname, 'src/resilience'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@i18n': resolve(__dirname, 'src/i18n'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/db/migrations/**'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});