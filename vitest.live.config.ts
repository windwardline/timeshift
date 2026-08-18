import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Opt-in config for checks that need a real database, kept out of the default
// suite (vitest.config.ts includes only `**/*.test.ts`) so CI, which has no
// Postgres, never picks them up. Run with `npm run ratelimit:check`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.live.ts'],
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
});
