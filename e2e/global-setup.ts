import { execFileSync } from 'node:child_process';

// Seed the demo showcase trip before the suite so the home page renders a
// deterministic itinerary for the regression assertions (CLAUDE.md §8.B). Runs
// once, regardless of whether the webServer is freshly started or reused.
// execFileSync (no shell) over execSync — no command string to interpolate.
export default function globalSetup(): void {
  execFileSync('npm', ['run', 'seed'], { stdio: 'inherit' });
}
