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
      // lib/rag/** (US-R) is the same pattern: pure retrieval/grounding units are
      // covered, while its network/fs shells (embed.ts, corpus.ts) self-exclude
      // with the same /* v8 ignore file */ pragma per CLAUDE.md §13.
      include: [
        'lib/engine/**',
        'lib/ai/**',
        'lib/rag/**',
        'lib/trips/**',
        'lib/flights/**',
        'lib/auth/credentials.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
