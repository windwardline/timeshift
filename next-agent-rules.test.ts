import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// `next dev` writes into the working tree. Two files, two different problems,
// both of which showed up as unexplained modifications during unrelated work:
//
//   AGENTS.md    — when it detects an AI coding agent (CLAUDECODE and friends),
//                  Next appends a managed "nextjs-agent-rules" block to this
//                  repo's operating contract and tells whoever finds it to just
//                  commit it. That is a tool editing the document that governs
//                  how this repo is worked on, without the owner deciding to.
//   next-env.d.ts — rewritten by `next dev` and `next build` with DIFFERENT
//                  contents (`.next/dev/types/…` vs `.next/types/…`), so it
//                  flips back and forth for anyone who runs both.
//
// Both are fixed at the source rather than by reverting after the fact, and this
// holds the fix: a config key can be dropped in a refactor, and the symptom only
// reappears the next time somebody runs the dev server.
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** The marker Next writes around its managed block. */
const INJECTED_BLOCK = 'BEGIN:nextjs-agent-rules';

describe('next dev must not edit tracked files', () => {
  it('turns the agent-rules injection off in next.config', () => {
    // Supported and documented: config-shared.d.ts declares `agentRules?: boolean`
    // defaulting to true, and start-server.js only calls the writer when it is
    // not false. Not a hack around the behaviour — the switch Next provides.
    expect(read('next.config.mjs')).toMatch(/agentRules:\s*false/);
  });

  it('has no injected block in the operating contract', () => {
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      expect(read(file), `${file} carries Next's managed block`).not.toContain(INJECTED_BLOCK);
    }
  });

  it('does not track next-env.d.ts, which dev and build disagree about', () => {
    // create-next-app's own .gitignore lists it for this reason.
    expect(read('.gitignore')).toMatch(/^next-env\.d\.ts$/m);
  });

  it('regenerates next-env.d.ts before typechecking', () => {
    // Untracking it is only safe because typecheck no longer depends on the file
    // being in the checkout. CI runs typecheck BEFORE build, so without this the
    // very first CI step fails on a fresh clone.
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts.typecheck, 'typecheck must generate the types it needs').toContain(
      'next typegen',
    );
  });
});
