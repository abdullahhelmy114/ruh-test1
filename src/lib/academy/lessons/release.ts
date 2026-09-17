/**
 * LOCKED PRODUCT RULE — Lesson Sheet release.
 *
 *   A Lesson Sheet becomes available to the Student and the Teacher ONE FULL
 *   LOCAL CALENDAR WEEK BEFORE THE SESSION, AT THE SAME ACADEMY-LOCAL CLOCK
 *   TIME AS THE SESSION.
 *
 * This is code, not configuration: it is not in the policy registry and no
 * setting can change it. The only input is the academy time zone
 * (`institution.timezone`), which decides what "local calendar week" and
 * "local clock time" mean.
 *
 * It is deliberately NOT `sessionStart - 7 * 24h`. When a daylight-saving
 * change happens during that week, the naive subtraction lands an hour away
 * from the session's local clock time. Here the session instant is turned
 * into academy-local date and time, the local date moves back seven calendar
 * days with the clock time unchanged, and the result is turned back into an
 * instant.
 *
 * Local times that do not exist or exist twice (daylight-saving gaps and
 * overlaps) are resolved like the ECMAScript Temporal "compatible" option:
 * a skipped time moves forward by the length of the gap, and a repeated
 * time uses its earlier occurrence.
 *
 * Administrators keep administrative visibility regardless of this rule;
 * that exemption is applied by the service, never by callers passing flags.
 */

export interface WallClock {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export const RELEASE_LEAD_DAYS = 7;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The academy-local calendar date and clock time of an instant. */
export function wallClockAt(epochMs: number, timeZone: string): WallClock {
  if (!Number.isFinite(epochMs)) throw new RangeError("Invalid instant.");
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new RangeError(`Missing ${type} while resolving a time zone.`);
    return Number(part.value);
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
    millisecond: new Date(epochMs).getUTCMilliseconds(),
  };
}

function wallClockAsUtcMs(wall: WallClock): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
}

/** UTC offset (ms, east positive) in force at an instant. */
export function offsetAt(epochMs: number, timeZone: string): number {
  return wallClockAsUtcMs(wallClockAt(epochMs, timeZone)) - epochMs;
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second &&
    a.millisecond === b.millisecond
  );
}

/**
 * The instant at which an academy-local date and clock time occurs
 * ("compatible" disambiguation, see the module comment).
 */
export function instantOfWallClock(wall: WallClock, timeZone: string): number {
  const asUtc = wallClockAsUtcMs(wall);
  const DAY = 86_400_000;
  // Offsets on either side of any transition near this local time.
  const offsets = new Set([offsetAt(asUtc - DAY, timeZone), offsetAt(asUtc, timeZone), offsetAt(asUtc + DAY, timeZone)]);
  const candidates = [...offsets].map((offset) => asUtc - offset);
  const valid = candidates.filter((candidate) => sameWallClock(wallClockAt(candidate, timeZone), wall)).sort((a, b) => a - b);
  if (valid.length > 0) return valid[0]; // unique, or the earlier of a repeated time
  // Skipped local time: push forward by the gap, i.e. read it with the offset in force before the gap.
  return Math.max(...candidates);
}

/** Moves a calendar date by whole days, independent of any time zone. */
export function addCalendarDays(wall: WallClock, days: number): WallClock {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** The instant a session's Lesson Sheet becomes available to its learners and teachers. */
export function lessonSheetReleaseAt(sessionStartsAt: string, timeZone: string): string {
  const startMs = Date.parse(sessionStartsAt);
  if (Number.isNaN(startMs)) throw new RangeError("Invalid session start.");
  const localStart = wallClockAt(startMs, timeZone);
  const localRelease = addCalendarDays(localStart, -RELEASE_LEAD_DAYS);
  return new Date(instantOfWallClock(localRelease, timeZone)).toISOString();
}

export interface ReleaseSession {
  readonly startsAt: string;
  readonly state: string;
}

export type SheetAvailability =
  | { readonly status: "released"; readonly releaseAt: string }
  | { readonly status: "scheduled"; readonly releaseAt: string }
  | { readonly status: "no_session" };

/**
 * Availability of a lesson's sheet for one class group. Cancelled sessions
 * never release anything; the earliest remaining session decides.
 */
export function sheetAvailability(sessions: readonly ReleaseSession[], timeZone: string, now: Date): SheetAvailability {
  const releaseTimes = sessions
    .filter((session) => session.state !== "cancelled")
    .map((session) => lessonSheetReleaseAt(session.startsAt, timeZone))
    .sort();
  if (releaseTimes.length === 0) return { status: "no_session" };
  const releaseAt = releaseTimes[0];
  return Date.parse(releaseAt) <= now.getTime() ? { status: "released", releaseAt } : { status: "scheduled", releaseAt };
}
