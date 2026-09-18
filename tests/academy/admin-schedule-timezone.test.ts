/**
 * Administrators schedule on the academy's clock, not their browser's.
 *
 * The launch E2E audit (2026-09-18) found the session, reschedule and
 * assignment forms read their `datetime-local` values in the browser's zone:
 * an administrator in London typing 18:00 for an Istanbul academy scheduled
 * the session at 20:00 academy time, and the Lesson Sheet released two hours
 * off. The inputs now read and show academy-local time.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isoToWallClockInput, wallClockInputToIso } from "../../src/lib/academy/workspace/wall-clock-input.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source with comments removed, so a comment that mentions a pattern cannot satisfy or break an assertion. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("datetime-local values are read on the academy's clock", () => {
  test("Istanbul wall time becomes the right instant, whatever zone this process runs in", () => {
    assert.equal(wallClockInputToIso("2026-10-05T18:00", "Europe/Istanbul"), "2026-10-05T15:00:00.000Z");
    assert.equal(wallClockInputToIso("2026-10-05T18:00", "Europe/London"), "2026-10-05T17:00:00.000Z");
    assert.equal(wallClockInputToIso("2026-12-05T18:00", "Europe/London"), "2026-12-05T18:00:00.000Z");
  });

  test("instants are shown back on the academy's clock", () => {
    assert.equal(isoToWallClockInput("2026-10-05T15:00:00.000Z", "Europe/Istanbul"), "2026-10-05T18:00");
    assert.equal(isoToWallClockInput("2026-10-05T15:00:00.000Z", "Asia/Tokyo"), "2026-10-06T00:00");
    for (const value of ["2026-01-01T00:00", "2026-06-30T23:59", "2027-02-28T09:15"]) {
      assert.equal(isoToWallClockInput(wallClockInputToIso(value, "Europe/Istanbul"), "Europe/Istanbul"), value);
    }
  });

  test("daylight-saving gaps and overlaps resolve like the release rule", () => {
    // 02:30 does not exist in New York on 8 March 2026: it moves forward by the gap (03:30 EDT).
    assert.equal(wallClockInputToIso("2026-03-08T02:30", "America/New_York"), "2026-03-08T07:30:00.000Z");
    // 01:30 happens twice on 1 November 2026: the earlier (EDT) occurrence.
    assert.equal(wallClockInputToIso("2026-11-01T01:30", "America/New_York"), "2026-11-01T05:30:00.000Z");
  });

  test("without an academy time zone nothing is guessed", () => {
    assert.equal(wallClockInputToIso("2026-10-05T18:00", null), undefined);
    assert.equal(isoToWallClockInput("2026-10-05T15:00:00.000Z", null), "");
  });

  test("malformed and impossible values are refused", () => {
    for (const value of ["", "2026-10-05", "2026-10-05 18:00", "2026-13-01T10:00", "2026-02-31T10:00", "2026-10-05T24:00", "garbage"]) {
      assert.equal(wallClockInputToIso(value, "Europe/Istanbul"), undefined, value);
    }
    assert.equal(isoToWallClockInput("not a date", "Europe/Istanbul"), "");
  });
});

describe("the administration forms use the academy clock", () => {
  test("every schedule, reschedule and assignment time passes the workspace time zone", () => {
    const src = code("src/components/academy/workspace/admin/class-group.tsx");
    const reads = src.match(/localToIso\([^)]*\)/g) ?? [];
    const shows = src.match(/isoToLocal\([^)]*\)/g) ?? [];
    assert.equal(reads.length, 6);
    assert.equal(shows.length, 2);
    for (const call of [...reads, ...shows]) assert.match(call, /, timeZone\)$/, call);
    assert.equal((src.match(/hint=\{<ZoneHint \/>\}/g) ?? []).length, 3);
    // The hint is announced with the field it explains.
    for (const id of ['"schedule-starts-hint"', "{`${id}-starts-hint`}", '"assign-opens-hint"']) assert.ok(src.includes(`aria-describedby=${id}`), id);
  });

  test("the helpers no longer parse input with the browser's Date", () => {
    const kit = code("src/components/academy/workspace/admin/kit.tsx");
    assert.match(kit, /export const localToIso = wallClockInputToIso;/);
    assert.match(kit, /export const isoToLocal = isoToWallClockInput;/);
    assert.doesNotMatch(kit, /getHours\(\)|getFullYear\(\)|new Date\(value\)/);
  });
});
