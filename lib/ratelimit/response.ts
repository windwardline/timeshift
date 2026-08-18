import { NextResponse } from 'next/server';

// One shape for every refusal, so a limited caller always learns when to come
// back. `Retry-After` is the standard companion to 429; without it a client can
// only guess, and guessing means retrying immediately.
export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests — please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
