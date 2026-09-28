/**
 * Soft in-memory rate limit for single-node MVP.
 * Keyed by IP and/or email. Not shared across processes/replicas.
 * Documented limit: ≤10 failures / 15 min → 429.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export function checkRateLimit(key: string): {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    return { ok: true, remaining: MAX_FAILURES, retryAfterSec: 0 };
  }
  if (b.count >= MAX_FAILURES) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    remaining: MAX_FAILURES - b.count,
    retryAfterSec: 0,
  };
}

export function recordRateLimitFailure(key: string): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  b.count += 1;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test helper — wipe all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const RATE_LIMIT_MAX = MAX_FAILURES;
export const RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const MIN_PASSWORD_LENGTH = 10;
