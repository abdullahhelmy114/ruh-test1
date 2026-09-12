/**
 * Phase 2.4a — streak rules (pure). The same-day case is the farming fix:
 * repeated calls on one day must neither change the streak nor award points.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeStreakUpdate, pointsForStreak, toDateKey } from "../../src/lib/gamification/streak-rules.ts";

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe("computeStreakUpdate", () => {
  test("same day: no change, no points, no write", () => {
    const r = computeStreakUpdate({ currentStreak: 4, longestStreak: 6, lastActivityDate: "2026-09-10" }, day("2026-09-10"));
    assert.deepEqual(r, { newStreak: 4, newLongestStreak: 6, pointsEarned: 0, changed: false });
  });

  test("same day repeated many times still awards nothing", () => {
    let state = { currentStreak: 1, longestStreak: 1, lastActivityDate: "2026-09-10" as string | null };
    let total = 0;
    for (let i = 0; i < 50; i++) {
      const r = computeStreakUpdate(state, day("2026-09-10"));
      total += r.pointsEarned;
      state = { currentStreak: r.newStreak, longestStreak: r.newLongestStreak, lastActivityDate: "2026-09-10" };
    }
    assert.equal(total, 0);
    assert.equal(state.currentStreak, 1);
  });

  test("next day increments and updates the longest streak", () => {
    const r = computeStreakUpdate({ currentStreak: 2, longestStreak: 2, lastActivityDate: "2026-09-10" }, day("2026-09-11"));
    assert.deepEqual(r, { newStreak: 3, newLongestStreak: 3, pointsEarned: 3, changed: true });
  });

  test("gap of 2 or 3 days keeps the streak (no increment)", () => {
    for (const d of ["2026-09-12", "2026-09-13"]) {
      const r = computeStreakUpdate({ currentStreak: 5, longestStreak: 8, lastActivityDate: "2026-09-10" }, day(d));
      assert.equal(r.newStreak, 5, d);
      assert.equal(r.newLongestStreak, 8, d);
      assert.equal(r.changed, true, d);
      assert.equal(r.pointsEarned, 3, d);
    }
  });

  test("gap of more than 3 days resets to 1", () => {
    const r = computeStreakUpdate({ currentStreak: 9, longestStreak: 9, lastActivityDate: "2026-09-01" }, day("2026-09-10"));
    assert.deepEqual(r, { newStreak: 1, newLongestStreak: 9, pointsEarned: 2, changed: true });
  });

  test("first activity starts at 1", () => {
    const r = computeStreakUpdate({ currentStreak: 0, longestStreak: 0, lastActivityDate: null }, day("2026-09-10"));
    assert.deepEqual(r, { newStreak: 1, newLongestStreak: 1, pointsEarned: 2, changed: true });
  });
});

describe("pointsForStreak", () => {
  test("tiers: below 3 -> 2, 3 to 6 -> 3, 7 and above -> 5", () => {
    assert.equal(pointsForStreak(1), 2);
    assert.equal(pointsForStreak(2), 2);
    assert.equal(pointsForStreak(3), 3);
    assert.equal(pointsForStreak(6), 3);
    assert.equal(pointsForStreak(7), 5);
    assert.equal(pointsForStreak(30), 5);
  });
});

describe("toDateKey", () => {
  test("produces a YYYY-MM-DD key and ignores the time of day", () => {
    assert.match(toDateKey(day("2026-09-10")), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(toDateKey(day("2026-09-10")), toDateKey(new Date("2026-09-10T23:30:00")));
  });
});
