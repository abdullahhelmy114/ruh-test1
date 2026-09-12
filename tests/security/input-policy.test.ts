/**
 * Phase 3 batch 5 — input boundary helpers. Behavioural only.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  boundedPositiveInt,
  boundedString,
  isAllowedStringArray,
  isCouponCodeShape,
  isFirebaseUidShape,
  isPusherChannelShape,
  isTtsVoiceShape,
  normalizeCouponCode,
  optionalBoundedString,
} from "../../src/lib/security/input-policy.ts";

describe("boundedString", () => {
  test("accepts strings within bounds and trims by default", () => {
    assert.equal(boundedString("  hello ", { max: 10 }), "hello");
    assert.equal(boundedString("x".repeat(10), { max: 10 }), "x".repeat(10));
    assert.equal(boundedString("ab", { min: 2, max: 2 }), "ab");
  });
  test("rejects empty (default min 1), oversized and non-strings without truncating", () => {
    assert.equal(boundedString("", { max: 10 }), null);
    assert.equal(boundedString("   ", { max: 10 }), null);
    assert.equal(boundedString("x".repeat(11), { max: 10 }), null);
    for (const bad of [null, undefined, 5, {}, [], true]) assert.equal(boundedString(bad, { max: 10 }), null);
  });
  test("min 0 allows empty; trim can be disabled", () => {
    assert.equal(boundedString("", { min: 0, max: 5 }), "");
    assert.equal(boundedString(" a ", { max: 5, trim: false }), " a ");
    assert.equal(boundedString("      ", { max: 5, trim: false }), null, "6 untrimmed chars exceed max 5");
  });
  test("optionalBoundedString: absent -> empty string, present must be bounded", () => {
    assert.equal(optionalBoundedString(undefined, 5), "");
    assert.equal(optionalBoundedString(null, 5), "");
    assert.equal(optionalBoundedString("abc", 5), "abc");
    assert.equal(optionalBoundedString("abcdef", 5), null);
    assert.equal(optionalBoundedString(5, 5), null);
  });
});

describe("boundedPositiveInt", () => {
  test("accepts integers inside the range, including the ends", () => {
    assert.equal(boundedPositiveInt(1, 1, 20), 1);
    assert.equal(boundedPositiveInt(20, 1, 20), 20);
    assert.equal(boundedPositiveInt(10, 1, 20), 10);
  });
  test("rejects outside the range, floats, strings, NaN, Infinity and booleans", () => {
    for (const bad of [0, 21, -1, 1.5, "10", "5", NaN, Infinity, -Infinity, true, null, undefined, {}]) {
      assert.equal(boundedPositiveInt(bad, 1, 20), null, `should reject ${String(bad)}`);
    }
  });
});

describe("isFirebaseUidShape", () => {
  test("accepts current-style uids and bounded URL-safe strings", () => {
    assert.equal(isFirebaseUidShape("AbC123xyz_-0987654321ABCDEFG"), true);
    assert.equal(isFirebaseUidShape("a"), true);
    assert.equal(isFirebaseUidShape("x".repeat(128)), true);
  });
  test("rejects separators, control characters, whitespace, empties and oversize", () => {
    for (const bad of ["", "x".repeat(129), "a b", "a/b", "a\\b", "a\nb", "a\0b", "a.b", "a@b", "<uid>", 42, null, undefined, ["a"]]) {
      assert.equal(isFirebaseUidShape(bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe("isPusherChannelShape", () => {
  test("accepts the Pusher character set up to 164 chars", () => {
    assert.equal(isPusherChannelShape("room-1"), true);
    assert.equal(isPusherChannelShape("private-course_42=a@b,c.d;e"), true);
    assert.equal(isPusherChannelShape("x".repeat(164)), true);
  });
  test("rejects invalid characters, empties and > 164 chars", () => {
    for (const bad of ["", "x".repeat(165), "room 1", "room/1", "room#1", "room!1", "room\n1", "room:1", "روم", 1, null]) {
      assert.equal(isPusherChannelShape(bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe("coupon code", () => {
  test("normalisation trims and upper-cases", () => {
    assert.equal(normalizeCouponCode("  ramadan25 "), "RAMADAN25");
    assert.equal(normalizeCouponCode("abc"), "ABC");
    assert.equal(normalizeCouponCode(""), "");
    assert.equal(normalizeCouponCode(5), null);
    assert.equal(normalizeCouponCode(null), null);
  });
  test("shape: 3..32 of A-Z 0-9 _ -", () => {
    assert.equal(isCouponCodeShape("ABC"), true);
    assert.equal(isCouponCodeShape("SAVE_10-NOW"), true);
    assert.equal(isCouponCodeShape("A".repeat(32)), true);
    for (const bad of ["AB", "A".repeat(33), "abc", "SAVE 10", "SAVE%10", "SAVE.10", "", "ÖZEL", null, 10]) {
      assert.equal(isCouponCodeShape(bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe("isTtsVoiceShape", () => {
  test("accepts every voice id the lesson editor offers", () => {
    for (const v of [
      "ar-EG-SalmaNeural", "ar-EG-ShakirNeural", "ar-SA-HamedNeural", "ar-SA-ZariyahNeural", "ar-SY-AmanyNeural",
      "en-GB-RyanNeural", "en-GB-SoniaNeural", "en-US-GuyNeural", "en-US-JennyNeural", "tr-TR-AhmetNeural", "tr-TR-EmelNeural",
    ]) {
      assert.equal(isTtsVoiceShape(v), true, v);
    }
  });
  test("rejects arbitrary or oversized identifiers and SSML-looking input", () => {
    for (const bad of ["", "Hamed", "ar-SA-Hamed", "AR-sa-HamedNeural", "ar-SA-Hamed Neural", "ar-SA-<voice>Neural",
      "ar-SA-" + "A".repeat(41) + "Neural", "ar-SA-HamedNeural'/>", "x".repeat(5000), 1, null]) {
      assert.equal(isTtsVoiceShape(bad), false, `should reject ${JSON.stringify(bad).slice(0, 40)}`);
    }
  });
});

describe("isAllowedStringArray", () => {
  const allowed = new Set(["choice", "true_false", "matching"]);
  test("accepts 1..max distinct members", () => {
    assert.equal(isAllowedStringArray(["choice"], allowed, 8), true);
    assert.equal(isAllowedStringArray(["choice", "matching"], allowed, 8), true);
  });
  test("rejects empties, unknown members, duplicates, oversize and non-arrays", () => {
    assert.equal(isAllowedStringArray([], allowed, 8), false);
    assert.equal(isAllowedStringArray(["essay"], allowed, 8), false);
    assert.equal(isAllowedStringArray(["choice", "choice"], allowed, 8), false, "duplicates inflate work");
    assert.equal(isAllowedStringArray(["choice", "matching", "true_false"], allowed, 2), false);
    assert.equal(isAllowedStringArray([1], allowed, 8), false);
    assert.equal(isAllowedStringArray("choice", allowed, 8), false);
    assert.equal(isAllowedStringArray(null, allowed, 8), false);
  });
});
