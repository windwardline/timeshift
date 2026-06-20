import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The temporal engine and the deterministic AI surface are the TDD core,
      // held at 100% coverage. lib/ai/client.ts (the only real-network module)
      // excludes itself with a /* v8 ignore file */ pragma per docs/AI_ADVICE.md §6.
      include: ['lib/engine/**', 'lib/ai/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
