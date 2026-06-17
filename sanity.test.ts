import { describe, it, expect } from 'vitest';

// Phase 0 harness check: proves Vitest runs before any real test exists.
describe('vitest harness sanity', () => {
  it('adds 1 + 1 to equal 2', () => {
    expect(1 + 1).toBe(2);
  });
});
