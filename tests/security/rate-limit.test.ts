/**
 * Phase 3 batch 3 — in-memory rate limiter and anonymous client key.
 * Deterministic: every check injects `now`; no timers, no environment.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_KEY_LENGTH,
  boundKey,
  checkRateLimit,
  clientKey,
  createRateLimiter,
  normalizeEmail,
  retryAfterSeconds,
} from "../../src/lib/security/rate-limit.ts";

const OPTS = { limit: 3, windowMs: 60_000 };
const T0 = 1_800_000_000_000;

describe("createRateLimiter: fixed window", () => {
  test("first request is allowed and reports remaining", () => {
    const rl = createRateLimiter();
    const r = rl.check("k", { ...OPTS, now: T0 });
    assert.deepEqual(r, { allowed: true, limit: 3, remaining: 2, retryAfterMs: 0 });
  });

  test("requests are allowed until the limit, then rejected with a sane retryAfterMs", () => {
    const rl = createRateLimiter();
    assert.equal(rl.check("k", { ...OPTS, now: T0 }).allowed, true);
    assert.equal(rl.check("k", { ...OPTS, now: T0 + 1000 }).allowed, true);
    assert.equal(rl.check("k", { ...OPTS, now: T0 + 2000 }).remaining, 0);
    const rejected = rl.check("k", { ...OPTS, now: T0 + 3000 });
    assert.equal(rejected.allowed, false);
    assert.equal(rejected.remaining, 0);
    assert.equal(rejected.retryAfterMs, 60_000 - 3000);
    assert.equal(retryAfterSeconds(rejected), 57);
    // Rejections do not extend the window.
    assert.equal(rl.check("k", { ...OPTS, now: T0 + 4000 }).retryAfterMs, 56_000);
  });

  test("different keys are isolated", () => {
    const rl = createRateLimiter();
    for (let i = 0; i < 3; i++) rl.check("a", { ...OPTS, now: T0 });
    assert.equal(rl.check("a", { ...OPTS, now: T0 }).allowed, false);
    assert.equal(rl.check("b", { ...OPTS, now: T0 }).allowed, true);
  });

  test("window expiration resets the count", () => {
    const rl = createRateLimiter();
    for (let i = 0; i < 3; i++) rl.check("k", { ...OPTS, now: T0 });
    assert.equal(rl.check("k", { ...OPTS, now: T0 + 59_999 }).allowed, false);
    const fresh = rl.check("k", { ...OPTS, now: T0 + 60_000 });
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.remaining, 2);
  });

  test("injected clock is deterministic and never reads Date.now", () => {
    const rl = createRateLimiter();
    const past = 1000;
    rl.check("k", { limit: 1, windowMs: 10, now: past });
    assert.equal(rl.check("k", { limit: 1, windowMs: 10, now: past + 5 }).allowed, false);
    assert.equal(rl.check("k", { limit: 1, windowMs: 10, now: past + 10 }).allowed, true);
  });

  test("retryAfterSeconds is at least 1 second", () => {
    assert.equal(retryAfterSeconds({ allowed: false, limit: 1, remaining: 0, retryAfterMs: 1 }), 1);
    assert.equal(retryAfterSeconds({ allowed: false, limit: 1, remaining: 0, retryAfterMs: 1500 }), 2);
  });
});

describe("createRateLimiter: bounded memory", () => {
  test("expired entries are swept so the store does not grow forever", () => {
    const rl = createRateLimiter({ sweepEvery: 10 });
    for (let i = 0; i < 50; i++) rl.check(`k${i}`, { limit: 1, windowMs: 100, now: T0 });
    assert.equal(rl.size(), 50);
    // Past the window: the next sweep drops all expired keys.
    for (let i = 0; i < 10; i++) rl.check(`fresh${i}`, { limit: 1, windowMs: 100, now: T0 + 1000 });
    assert.ok(rl.size() <= 10, `expected <= 10 live keys, got ${rl.size()}`);
  });

  test("maxKeys is a hard bound even with unique, unexpired keys", () => {
    const rl = createRateLimiter({ maxKeys: 100, sweepEvery: 1 });
    for (let i = 0; i < 1000; i++) rl.check(`attacker-${i}`, { limit: 5, windowMs: 3_600_000, now: T0 + i });
    assert.ok(rl.size() <= 100, `store grew to ${rl.size()}`);
  });

  test("oversized keys are truncated to MAX_KEY_LENGTH and still limited", () => {
    const rl = createRateLimiter();
    const huge = "x".repeat(10_000);
    assert.equal(boundKey(huge).length, MAX_KEY_LENGTH);
    rl.check(huge, { limit: 1, windowMs: 1000, now: T0 });
    assert.equal(rl.check(huge, { limit: 1, windowMs: 1000, now: T0 }).allowed, false);
    assert.equal(rl.size(), 1);
  });

  test("shared checkRateLimit uses the process-wide limiter", () => {
    const key = `shared-${T0}`;
    assert.equal(checkRateLimit(key, { limit: 1, windowMs: 1000, now: T0 }).allowed, true);
    assert.equal(checkRateLimit(key, { limit: 1, windowMs: 1000, now: T0 }).allowed, false);
  });
});

describe("clientKey: best-effort anonymous key", () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } });

  test("uses the first x-forwarded-for hop, trimmed and lower-cased", () => {
    assert.equal(clientKey(req({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" })), "ip:203.0.113.9");
    assert.equal(clientKey(req({ "x-forwarded-for": "2001:DB8::1" })), "ip:2001:db8::1");
  });

  test("falls back to x-real-ip, then to a shared unknown bucket", () => {
    assert.equal(clientKey(req({ "x-real-ip": "198.51.100.7" })), "ip:198.51.100.7");
    assert.equal(clientKey(req({})), "ip:unknown");
  });

  test("malformed or oversized header values never become limiter keys", () => {
    assert.equal(clientKey(req({ "x-forwarded-for": "a".repeat(5000) })), "ip:unknown");
    assert.equal(clientKey(req({ "x-forwarded-for": "<script>alert(1)</script>" })), "ip:unknown");
    assert.equal(clientKey(req({ "x-forwarded-for": "203.0.113.9; DROP TABLE" })), "ip:unknown");
    assert.equal(clientKey(req({ "x-forwarded-for": "" })), "ip:unknown");
    assert.equal(clientKey(req({ "x-forwarded-for": "not an ip" })), "ip:unknown");
  });
});

describe("normalizeEmail", () => {
  test("trims, lower-cases and validates shape", () => {
    assert.equal(normalizeEmail("  Student@Example.COM "), "student@example.com");
    for (const bad of ["", "nope", "a@b", "a b@c.com", "@x.com", "x@", null, 5, "a".repeat(300) + "@x.com"]) {
      assert.equal(normalizeEmail(bad), null, `should reject ${String(bad)}`);
    }
  });
});
