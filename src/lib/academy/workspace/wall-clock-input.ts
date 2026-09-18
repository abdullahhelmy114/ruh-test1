/**
 * Date-and-time inputs on the academy's clock.
 *
 * Administrators type session and assignment times into `datetime-local`
 * inputs, which carry a wall-clock time with no zone. Those times mean the
 * academy's local time: the same clock every displayed session time and the
 * Lesson Sheet release rule use. They used to be read in the administrator's
 * browser zone, so an administrator abroad scheduled sessions hours away from
 * the time they typed.
 *
 * With no academy time zone there is no correct reading, so nothing is
 * produced and the server refuses the request instead of guessing.
 * Daylight-saving gaps and overlaps resolve as in the release rule.
 */
import { instantOfWallClock, wallClockAt } from "../lessons/release.ts";

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** A `datetime-local` value ("YYYY-MM-DDTHH:mm") read in `timeZone`, as an ISO instant; undefined when it cannot be read. */
export function wallClockInputToIso(value: string, timeZone: string | null): string | undefined {
  const match = DATETIME_LOCAL.exec(value);
  if (!match || !timeZone) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return undefined;
  try {
    const instant = instantOfWallClock({ year, month, day, hour, minute, second: 0, millisecond: 0 }, timeZone);
    // Reject dates that do not exist (31 February rolls into March otherwise).
    const back = wallClockAt(instant, timeZone);
    if (back.year !== year || back.month !== month || back.day !== day) return undefined;
    return new Date(instant).toISOString();
  } catch {
    return undefined;
  }
}

/** An ISO instant as a `datetime-local` value on `timeZone`'s clock; empty when it cannot be shown. */
export function isoToWallClockInput(iso: string | null | undefined, timeZone: string | null): string {
  if (!iso || !timeZone) return "";
  const epoch = Date.parse(iso);
  if (Number.isNaN(epoch)) return "";
  try {
    const wall = wallClockAt(epoch, timeZone);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
  } catch {
    return "";
  }
}
