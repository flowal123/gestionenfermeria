import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests hit real Supabase — run sequentially to avoid race conditions
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15000,
    hookTimeout: 20000,
    bail: process.env.CI ? 1 : 0,
    reporters: ['verbose'],
    setupFiles: ['./helpers/setup.js'],
    // globalSetup: logins (4 total) + asegura nurse B auth user — corre ANTES de todos los tests
    globalSetup: ['./vitest.globalSetup.js'],
  },
});
