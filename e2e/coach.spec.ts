import { test, expect } from '@playwright/test';

// §8.B regression check for the grounded Jetlag Coach (US-R). It is a test, not
// just a screenshotter: it ASSERTS the two headline behaviors against the running
// app on the keyless lexical path — a KB-covered question yields a grounded answer
// with the right Source, and an off-topic question is refused with no Sources.
test('coach answers a KB question with sources and refuses an off-topic one', async ({ page }) => {
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'Jetlag Coach' })).toBeVisible();

  const box = page.getByRole('textbox', { name: 'Your jetlag question' });
  const ask = page.getByRole('button', { name: 'Ask the coach' });

  // 1) Grounded: a melatonin question retrieves melatonin-timing.md deterministically.
  await box.fill('When should I take melatonin?');
  await ask.click();

  const result = page.getByTestId('coach-result');
  await expect(result).toHaveAttribute('data-grounded', 'true', { timeout: 30_000 });
  // A grounded answer renders non-empty prose. We assert it has content (not its
  // exact wording — model output is non-deterministic, CLAUDE.md §13).
  await expect(page.getByTestId('coach-answer')).toContainText(/\w/);
  // Follow-on advice: a next-step suggestion renders.
  await expect(page.getByTestId('coach-followup')).toBeVisible();
  // Source integrity (AC-R3): citations are VERIFIABLE external links, not internal
  // filenames. The melatonin question cites a melatonin source, as a real http link.
  const sourceLink = page.getByTestId('coach-sources').getByRole('link').first();
  await expect(sourceLink).toContainText('Melatonin');
  await expect(sourceLink).toHaveAttribute('href', /^https?:\/\//);

  await page.screenshot({ path: 'docs/screenshots/e2e-coach-grounded.png', fullPage: true });

  // 2) Refusal: an off-topic question with no KB overlap is honestly refused.
  await box.fill('How do I fix my car engine?');
  await ask.click();

  await expect(page.getByTestId('coach-result')).toHaveAttribute('data-grounded', 'false', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('coach-refusal')).toBeVisible();
  await expect(page.getByTestId('coach-sources')).toHaveCount(0);

  await page.screenshot({ path: 'docs/screenshots/e2e-coach-refusal.png', fullPage: true });
});
