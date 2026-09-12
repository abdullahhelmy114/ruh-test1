/**
 * In-memory fixed-window rate limiter (Phase 3 batch 3).
 *
 * IN-MEMORY LIMITER IS A CURRENT DEPLOYMENT CONTROL, NOT A FUTURE DISTRIBUTED
 * RATE-LIMIT ARCHITECTURE. It is correct for the single long-running Railway
 * Node instance this app deploys to; counters reset on restart and are not
 * shared across instances. A durable/distributed limiter can replace the
 * store later without changing the route-side API.
 *
 * Design:
 *   - dependency-free, deterministic (injectable clock), unit-testable
 *   - fixed window per key: the first hit opens a window of `windowMs`;
 *     hits beyond `limit` inside the window are rejected with `retryAfterMs`
 *   - bounded memory: keys are length-capped, expired entries are swept
 *     opportunistically, and the store never exceeds `maxKeys` (oldest
 *     entries are evicted first)
 *   - nothing sensitive is stored: only a normalised key, a count and a
 *     reset timestamp
 *
 * Keys are an ABUSE-CONTROL dimension, never an identity. `clientKey()`
 * derives a best-effort anonymous key from proxy headers; those headers are
 * attacker-influenceable in general and must never be used for authorization.
 */

export interface RateLimitOptions {
  /** Maximum hits allowed inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock (ms since epoch); defaults to Date.now(). */
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Hits still available in the current window (0 when rejected). */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export const MAX_KEY_LENGTH = 200;

export interface RateLimiter {
  check(key: string, options: RateLimitOptions): RateLimitResult;
  /** Number of live keys (for tests and diagnostics only). */
  size(): number;
}

export function createRateLimiter(config: { maxKeys?: number; sweepEvery?: number } = {}): RateLimiter {
  const maxKeys = Math.max(1, config.maxKeys ?? 10_000);
  const sweepEvery = Math.max(1, config.sweepEvery ?? 256);
  const buckets = new Map<string, Bucket>();
  let opsSinceSweep = 0;

  function sweep(now: number): void {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Hard bound: evict oldest insertions if still over capacity.
    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key, options) {
      const now = options.now ?? Date.now();
      const limit = Math.max(1, Math.floor(options.limit));
      const windowMs = Math.max(1, Math.floor(options.windowMs));
      const k = boundKey(key);

      if (++opsSinceSweep >= sweepEvery || buckets.size >= maxKeys) {
        opsSinceSweep = 0;
        sweep(now);
      }

      let bucket = buckets.get(k);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.delete(k); // refresh insertion order for eviction fairness
        buckets.set(k, bucket);
        // Hard bound holds after every insertion, not just at sweep time.
        if (buckets.size > maxKeys) sweep(now);
      }

      if (bucket.count >= limit) {
        return { allowed: false, limit, remaining: 0, retryAfterMs: Math.max(1, bucket.resetAt - now) };
      }
      bucket.count += 1;
      return { allowed: true, limit, remaining: limit - bucket.count, retryAfterMs: 0 };
    },
    size() {
      return buckets.size;
    },
  };
}

/** Shared process-wide limiter used by routes. */
const defaultLimiter = createRateLimiter();

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  return defaultLimiter.check(key, options);
}

/** Caps a key's length so attacker-controlled inputs cannot bloat the store. */
export function boundKey(key: string): string {
  const s = typeof key === "string" ? key : String(key);
  return s.length > MAX_KEY_LENGTH ? s.slice(0, MAX_KEY_LENGTH) : s;
}

const IP_CHARS = /^[0-9a-fA-F.:]{3,45}$/;

/**
 * Best-effort anonymous client key. Reads the first hop of `x-forwarded-for`
 * (set by the Railway edge proxy), then `x-real-ip`; each candidate is
 * trimmed, length-bounded and must look like an IP literal. Falls back to a
 * shared "unknown" bucket, which makes the limiter stricter, not looser.
 * NEVER use this value for authentication or authorization.
 */
export function clientKey(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (IP_CHARS.test(first)) return `ip:${first.toLowerCase()}`;
  }
  const real = req.headers.get("x-real-ip")?.trim() ?? "";
  if (IP_CHARS.test(real)) return `ip:${real.toLowerCase()}`;
  return "ip:unknown";
}

const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$/;

/** Lower-cased, trimmed, shape-checked email or null. Max 254 chars. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const e = value.trim().toLowerCase();
  if (e.length === 0 || e.length > 254 || !EMAIL_SHAPE.test(e)) return null;
  return e;
}

/** Seconds value for a Retry-After header (at least 1). */
export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil(result.retryAfterMs / 1000));
}
