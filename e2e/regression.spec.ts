import { test, expect } from '@playwright/test';

// §8.B regression check. Opens the running app, drives it to a known itinerary
// (the seeded showcase trip, rendered publicly on the home page), and asserts
// the temporal engine's headline numbers end-to-end: trip name, the home/dest
// zones, the computed clock shift, the rendered flight legs, and that an in-air
// sleep window is recommended. If the engine ever regresses, these fail.
//
// The showcase is "New York → Singapore (BA, via London)":
//   dest Asia/Singapore (UTC+8) vs home America/New_York (EDT, UTC-4) => +12.0h.
const TRIP_NAME = 'New York → Singapore (BA, via London)';

test('home showcase renders the engine headline numbers', async ({ page }) => {
  await page.goto('/');

  // Trip header — name + destination clock + home/dest route pills.
  await expect(page.getByRole('heading', { name: TRIP_NAME })).toBeVisible();
  await expect(page.getByText('Destination clock · Asia/Singapore')).toBeVisible();
  await expect(page.getByText('home America/New_York')).toBeVisible();
  await expect(page.getByText('dest Asia/Singapore')).toBeVisible();

  // The computed clock shift is the core engine output.
  await expect(page.locator('.shift')).toHaveText('+12.0h');

  // The timeline SVG carries the flight legs and the recommended sleep window.
  const timeline = page.getByRole('img', { name: /Journey timeline/ });
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText('BA 178 · JFK → LHR');
  await expect(timeline).toContainText('BA 11 · LHR → SIN');
  await expect(timeline).toContainText('sleep');

  await page.screenshot({ path: 'docs/screenshots/e2e-regression-home.png', fullPage: true });
});
