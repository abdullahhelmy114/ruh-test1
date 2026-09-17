/**
 * LOCKED RULE: a Lesson Sheet becomes available to Student and Teacher ONE
 * FULL LOCAL CALENDAR WEEK BEFORE THE SESSION, AT THE SAME ACADEMY-LOCAL CLOCK
 * TIME AS THE SESSION.
 *
 * These tests pin the rule down across daylight-saving changes, skipped and
 * repeated local times, month, year and leap-day boundaries, and prove it is
 * not implemented as `sessionStart - 7 * 24h`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RELEASE_LEAD_DAYS,
  addCalendarDays,
  instantOfWallClock,
  lessonSheetReleaseAt,
  sheetAvailability,
  wallClockAt,
} from "../../src/lib/academy/lessons/release.ts";
import { POLICY_KEYS, assertNotSecurityInvariant } from "../../src/lib/academy/policies/registry.ts";

const WEEK_MS = 7 * 24 * 3_600_000;

function naive(startsAt: string): string {
  return new Date(Date.parse(startsAt) - WEEK_MS).toISOString();
}

function localParts(instant: string, timeZone: string) {
  const w = wallClockAt(Date.parse(instant), timeZone);
  return { date: `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`, time: `${w.hour}:${w.minute}:${w.second}.${w.millisecond}` };
}

describe("lesson sheet release rule", () => {
  test("the lead time is exactly seven calendar days", () => {
    assert.equal(RELEASE_LEAD_DAYS, 7);
  });

  test("autumn clock change: same local clock time, one hour away from the naive week", () => {
    // London, Tuesday 27 Oct 2026 19:00 GMT (after the 25 Oct change).
    const start = "2026-10-27T19:00:00.000Z";
    const release = lessonSheetReleaseAt(start, "Europe/London");
    assert.equal(release, "2026-10-20T18:00:00.000Z"); // Tuesday 20 Oct 19:00 BST
    assert.notEqual(release, naive(start));
    assert.deepEqual(localParts(release, "Europe/London"), { date: "2026-10-20", time: localParts(start, "Europe/London").time });
  });

  test("spring clock change: same local clock time across the change", () => {
    // Berlin, Monday 30 Mar 2026 18:30 CEST (after the 29 Mar change) -> Monday 23 Mar 18:30 CET.
    const start = "2026-03-30T16:30:00.000Z";
    const release = lessonSheetReleaseAt(start, "Europe/Berlin");
    assert.equal(release, "2026-03-23T17:30:00.000Z");
    assert.notEqual(release, naive(start));
    assert.equal(localParts(release, "Europe/Berlin").time, localParts(start, "Europe/Berlin").time);
  });

  test("zones without daylight saving match seven 24-hour days", () => {
    for (const timeZone of ["Europe/Istanbul", "Asia/Riyadh", "UTC"]) {
      const start = "2026-10-27T16:00:00.000Z";
      assert.equal(lessonSheetReleaseAt(start, timeZone), naive(start), timeZone);
    }
  });

  test("a skipped local time moves forward by the gap", () => {
    // New York: session Sun 15 Mar 2026 02:30 EDT. Sun 8 Mar 02:30 does not exist -> 03:30 EDT.
    assert.equal(lessonSheetReleaseAt("2026-03-15T06:30:00.000Z", "America/New_York"), "2026-03-08T07:30:00.000Z");
  });

  test("a repeated local time uses its earlier occurrence", () => {
    // New York: session Sun 8 Nov 2026 01:30 EST. Sun 1 Nov 01:30 happens twice -> first (EDT).
    assert.equal(lessonSheetReleaseAt("2026-11-08T06:30:00.000Z", "America/New_York"), "2026-11-01T05:30:00.000Z");
  });

  test("southern hemisphere changes are handled the same way", () => {
    // Sydney: session Tue 7 Apr 2026 18:00 AEST (after 5 Apr change) -> Tue 31 Mar 18:00 AEDT.
    const start = "2026-04-07T08:00:00.000Z";
    const release = lessonSheetReleaseAt(start, "Australia/Sydney");
    assert.equal(release, "2026-03-31T07:00:00.000Z");
    assert.equal(localParts(release, "Australia/Sydney").time, localParts(start, "Australia/Sydney").time);
  });

  test("month, year and leap-day boundaries use calendar days", () => {
    assert.equal(localParts(lessonSheetReleaseAt("2027-01-03T09:15:30.250Z", "Asia/Riyadh"), "Asia/Riyadh").date, "2026-12-27");
    // 2028 is a leap year: Tue 7 Mar 2028 -> Tue 29 Feb 2028.
    assert.equal(localParts(lessonSheetReleaseAt("2028-03-07T12:00:00.000Z", "Europe/Istanbul"), "Europe/Istanbul").date, "2028-02-29");
    assert.deepEqual(addCalendarDays({ year: 2027, month: 3, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, -7).day, 22);
  });

  test("the local calendar date decides, not the UTC date", () => {
    // Tokyo: session Mon 5 Oct 2026 08:00 JST = Sun 4 Oct 23:00 UTC -> Mon 28 Sep 08:00 JST.
    const release = lessonSheetReleaseAt("2026-10-04T23:00:00.000Z", "Asia/Tokyo");
    assert.equal(release, "2026-09-27T23:00:00.000Z");
    assert.deepEqual(localParts(release, "Asia/Tokyo"), { date: "2026-09-28", time: "8:0:0.0" });
  });

  test("the release is always the same weekday and local clock time, one week earlier, all year", () => {
    for (const timeZone of ["Europe/London", "America/New_York", "Europe/Istanbul", "Australia/Sydney"]) {
      for (let day = 0; day < 366; day += 3) {
        const start = new Date(Date.UTC(2026, 0, 1, 17, 45) + day * 86_400_000).toISOString();
        const release = lessonSheetReleaseAt(start, timeZone);
        const s = wallClockAt(Date.parse(start), timeZone);
        const r = wallClockAt(Date.parse(release), timeZone);
        const expectedDate = addCalendarDays(s, -7);
        assert.deepEqual([r.year, r.month, r.day], [expectedDate.year, expectedDate.month, expectedDate.day], `${timeZone} ${start}`);
        assert.deepEqual([r.hour, r.minute], [s.hour, s.minute], `${timeZone} ${start}`);
      }
    }
  });

  test("wall clock conversion round-trips for ordinary times", () => {
    const wall = { year: 2026, month: 9, day: 17, hour: 14, minute: 5, second: 9, millisecond: 120 };
    const instant = instantOfWallClock(wall, "Europe/Istanbul");
    assert.deepEqual(wallClockAt(instant, "Europe/Istanbul"), wall);
  });
});

describe("sheet availability", () => {
  const tz = "Europe/London";
  const sessions = [
    { startsAt: "2026-10-27T19:00:00.000Z", state: "scheduled" },
    { startsAt: "2026-10-29T19:00:00.000Z", state: "scheduled" },
  ];

  test("the earliest remaining session decides, and the release instant itself is available", () => {
    assert.deepEqual(sheetAvailability(sessions, tz, new Date("2026-10-20T17:59:59.999Z")), { status: "scheduled", releaseAt: "2026-10-20T18:00:00.000Z" });
    assert.deepEqual(sheetAvailability(sessions, tz, new Date("2026-10-20T18:00:00.000Z")), { status: "released", releaseAt: "2026-10-20T18:00:00.000Z" });
  });

  test("cancelled sessions release nothing", () => {
    const [first, second] = sessions;
    const withCancelled = [{ ...first, state: "cancelled" }, second];
    assert.equal(sheetAvailability(withCancelled, tz, new Date("2026-10-21T12:00:00.000Z")).status, "scheduled");
    assert.deepEqual(sheetAvailability([{ ...first, state: "cancelled" }], tz, new Date("2027-01-01T00:00:00Z")), { status: "no_session" });
    assert.deepEqual(sheetAvailability([], tz, new Date()), { status: "no_session" });
  });

  test("completed sessions keep their sheet available", () => {
    assert.equal(sheetAvailability([{ ...sessions[0], state: "completed" }], tz, new Date("2026-11-30T00:00:00Z")).status, "released");
  });
});

describe("the release rule is locked code", () => {
  test("it is not configurable: no policy key names it and the registry refuses such keys", () => {
    // (assessment.result_release is about assessment results, not Lesson Sheets.)
    for (const key of POLICY_KEYS) {
      assert.equal(/lesson|sheet/i.test(key), false, key);
    }
    assert.throws(() => assertNotSecurityInvariant("lesson_sheet.release_offset_days"));
  });

  test("the implementation never subtracts a fixed number of milliseconds or hours", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "..", "src", "lib", "academy", "lessons", "release.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /7\s*\*\s*24|604_?800|168\s*\*/);
    assert.doesNotMatch(code, /getPolicy|POLICY_|policy/i);
  });
});
