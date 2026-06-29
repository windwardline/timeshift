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

  // Scope to the Singapore showcase's own container so the second (date-line)
  // showcase below can't make these locators ambiguous.
  const sg = page.getByTestId('showcase-Asia-Singapore');

  // The caption names the actual destination (Singapore), not a stale city.
  await expect(sg.getByText('A worked example — JFK → Singapore via London')).toBeVisible();

  // Trip header — name + destination clock + home/dest route pills.
  await expect(sg.getByRole('heading', { name: TRIP_NAME })).toBeVisible();
  await expect(sg.getByText('Destination clock · Asia/Singapore')).toBeVisible();
  await expect(sg.getByText('home America/New_York')).toBeVisible();
  await expect(sg.getByText('dest Asia/Singapore')).toBeVisible();

  // The computed clock shift is the core engine output.
  await expect(sg.locator('.shift')).toHaveText('+12.0h');

  // This everyday itinerary does not cross the date line, so no IDL pill.
  await expect(sg.getByTestId('crosses-date-line')).toHaveCount(0);

  // The timeline SVG carries the flight legs and the recommended sleep window.
  const timeline = sg.getByRole('img', { name: /Journey timeline/ });
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText('BA 178 · JFK → LHR');
  await expect(timeline).toContainText('BA 11 · LHR → SIN');
  await expect(timeline).toContainText('sleep');

  await page.screenshot({ path: 'docs/screenshots/e2e-regression-home.png', fullPage: true });
});

// §8.B regression for the date-line edge case (US-E3). LAX → Sydney eastbound
// "gains" a day, so the engine flags the IDL crossing and computes the +17.0h
// shift — both asserted here against the rendered showcase.
test('home showcase flags the date-line crossing example', async ({ page }) => {
  await page.goto('/');

  const idl = page.getByTestId('showcase-Australia-Sydney');
  await expect(idl.getByText('Crossing the date line — Los Angeles → Sydney')).toBeVisible();
  await expect(
    idl.getByRole('heading', { name: 'Los Angeles → Sydney (QF, across the date line)' }),
  ).toBeVisible();
  await expect(idl.getByText('dest Australia/Sydney')).toBeVisible();
  await expect(idl.locator('.shift')).toHaveText('+17.0h');
  // The engine's crossesDateLine fact is surfaced for this trip.
  await expect(idl.getByTestId('crosses-date-line')).toBeVisible();

  await page.screenshot({ path: 'docs/screenshots/e2e-regression-dateline.png', fullPage: true });
});
