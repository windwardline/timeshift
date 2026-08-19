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

  it('still finds the switch in the installed Next, not just in our config', () => {
    // The assertion above guards our own refactor. It cannot guard Next's.
    // `agentRules` is young and effectively undocumented -- establishing it
    // exists meant reading the package -- and Next only WARNS on an unrecognised
    // config key, so a release that renames or drops it leaves next.config.mjs
    // saying `agentRules: false`, every check green, and `next dev` quietly
    // appending to the operating contract again.
    //
    // That is a live path, not a hypothetical: `next` is pinned `^16.3.0`,
    // dependabot opens grouped production-dependency PRs weekly, and
    // dependabot-auto-merge.yml arms auto-merge on green CI. Asserting against
    // the installed package turns that into a red dependency PR, which is the
    // one moment somebody is already looking at the upgrade.
    const pkg = 'node_modules/next/dist/server';
    expect(read(`${pkg}/config-shared.d.ts`), 'Next no longer declares agentRules').toMatch(
      /agentRules\?:\s*boolean/,
    );
    expect(read(`${pkg}/lib/start-server.js`), 'Next no longer reads agentRules').toContain(
      'agentRules !== false',
    );
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
    // Note this guards `npm run typecheck`, not a bare `tsc --noEmit`. On a
    // fresh clone the latter now silently loses the `next` type references until
    // something has generated them; tsconfig.json's `include` still lists
    // next-env.d.ts, which is correct once typegen has run and inert before.
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts.typecheck, 'typecheck must generate the types it needs').toContain(
      'next typegen',
    );
  });
});
