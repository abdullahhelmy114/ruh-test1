/**
 * Phase 3 batch 4 — OTP helper. Behavioural tests only: no network, no
 * database, no real secret.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import {
  OTP_DIGEST_HEX_LENGTH,
  OTP_HMAC_DOMAIN,
  OTP_LENGTH,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  isOtpShape,
  otpExpiry,
  requireOtpSecret,
  verifyOtpHash,
} from "../../src/lib/security/otp.ts";

const SECRET = "unit-test-otp-secret-not-real";
const UID = "firebase-uid-AbC123";

describe("generateOtp", () => {
  test("always six ASCII digits within 000000..999999", () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateOtp();
      assert.equal(code.length, OTP_LENGTH);
      assert.match(code, /^[0-9]{6}$/);
      const n = Number(code);
      assert.ok(n >= 0 && n <= 999_999);
    }
  });

  test("is not degenerate (many distinct values)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateOtp());
    assert.ok(seen.size > 450, `expected high variety, got ${seen.size}`);
  });

  test("helper source uses crypto.randomInt and never Math.random", () => {
    // Comments stripped: the module doc mentions Math.random by name to forbid it.
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "lib", "security", "otp.ts"), "utf8")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(src.includes("randomInt("));
    assert.equal(src.includes("Math.random"), false);
    assert.ok(/from "node:crypto"/.test(src));
    assert.equal(/from ["']@\//.test(src), false, "helper must stay dependency-free");
  });
});

describe("isOtpShape", () => {
  test("accepts exactly six ASCII digits, including leading zeros", () => {
    assert.equal(isOtpShape("000000"), true);
    assert.equal(isOtpShape("000123"), true);
    assert.equal(isOtpShape("123456"), true);
    assert.equal(isOtpShape("999999"), true);
  });

  test("rejects wrong lengths, letters, whitespace, signs, unicode digits and non-strings", () => {
    for (const bad of [
      "12345", "1234567", "", "12345a", "abcdef", " 123456", "123456 ", "123 456", "12\n3456",
      "+123456", "-12345", "1e5000", "١٢٣٤٥٦", "１２３４５６", "12345６",
      123456, null, undefined, {}, ["123456"],
    ]) {
      assert.equal(isOtpShape(bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe("otpExpiry / requireOtpSecret", () => {
  test("expiry is exactly TTL after the given instant", () => {
    assert.equal(OTP_TTL_MS, 15 * 60 * 1000);
    assert.equal(otpExpiry(1_000_000).getTime(), 1_000_000 + OTP_TTL_MS);
  });

  test("secret is required", () => {
    assert.equal(requireOtpSecret(SECRET), SECRET);
    assert.throws(() => requireOtpSecret(undefined));
    assert.throws(() => requireOtpSecret(""));
  });
});

describe("hashOtp", () => {
  test("deterministic hex digest of the expected length", () => {
    const a = hashOtp(UID, "123456", SECRET);
    const b = hashOtp(UID, "123456", SECRET);
    assert.equal(a, b);
    assert.equal(a.length, OTP_DIGEST_HEX_LENGTH);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  test("digest is bound to uid, code and secret", () => {
    const base = hashOtp(UID, "123456", SECRET);
    assert.notEqual(hashOtp("other-uid", "123456", SECRET), base);
    assert.notEqual(hashOtp(UID, "123457", SECRET), base);
    assert.notEqual(hashOtp(UID, "123456", SECRET + "x"), base);
  });

  test("message is domain-separated from other uses of the same secret", () => {
    assert.equal(OTP_HMAC_DOMAIN, "ruh-otp-v1");
    const expected = createHmac("sha256", SECRET).update(`${OTP_HMAC_DOMAIN}:${UID}:123456`).digest("hex");
    assert.equal(hashOtp(UID, "123456", SECRET), expected);
    const undomained = createHmac("sha256", SECRET).update(`${UID}:123456`).digest("hex");
    assert.notEqual(hashOtp(UID, "123456", SECRET), undomained);
  });

  test("leading-zero codes hash and verify like any other", () => {
    const d = hashOtp(UID, "000123", SECRET);
    assert.equal(d.length, OTP_DIGEST_HEX_LENGTH);
    assert.equal(verifyOtpHash(UID, "000123", SECRET, d), true);
    assert.equal(verifyOtpHash(UID, "123", SECRET, d), false, "numeric coercion would not be accepted");
    assert.notEqual(hashOtp(UID, "000123", SECRET), hashOtp(UID, "100123", SECRET));
  });

  test("never stores the plaintext code and rejects bad input", () => {
    const digest = hashOtp(UID, "123456", SECRET);
    assert.equal(digest.includes("123456"), false);
    assert.throws(() => hashOtp(UID, "12345", SECRET));
    assert.throws(() => hashOtp("", "123456", SECRET));
    assert.throws(() => hashOtp(UID, "123456", ""));
  });
});

describe("verifyOtpHash", () => {
  const stored = hashOtp(UID, "654321", SECRET);

  test("correct code for the same uid passes", () => {
    assert.equal(verifyOtpHash(UID, "654321", SECRET, stored), true);
  });

  test("wrong code, wrong uid or wrong secret fails", () => {
    assert.equal(verifyOtpHash(UID, "654320", SECRET, stored), false);
    assert.equal(verifyOtpHash("someone-else", "654321", SECRET, stored), false);
    assert.equal(verifyOtpHash(UID, "654321", SECRET + "x", stored), false);
  });

  test("malformed submitted code fails without throwing", () => {
    for (const bad of ["65432", " 654321", "654321\n", "abcdef", 654321, null, undefined]) {
      assert.equal(verifyOtpHash(UID, bad, SECRET, stored), false);
    }
  });

  test("malformed or length-mismatched stored digest fails safely", () => {
    for (const bad of ["", "abc", stored.slice(0, 63), stored + "0", "z".repeat(64), "654321", null, undefined, 42]) {
      assert.doesNotThrow(() => verifyOtpHash(UID, "654321", SECRET, bad));
      assert.equal(verifyOtpHash(UID, "654321", SECRET, bad), false);
    }
  });

  test("a legacy plaintext row can never verify (forces resend after deploy)", () => {
    assert.equal(verifyOtpHash(UID, "654321", SECRET, "654321"), false);
  });
});
