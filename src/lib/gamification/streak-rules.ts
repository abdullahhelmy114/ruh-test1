/**
 * Pure streak rules (Phase 2.4a) — extracted from updateStreak so they can be
 * unit-tested and so the same-day case is explicit.
 *
 * Pre-existing rules, unchanged:
 *   - next day        -> streak + 1
 *   - gap of 2–3 days -> streak kept (not incremented)
 *   - gap > 3 days    -> reset to 1
 *   - first activity  -> 1
 *   - points: streak >= 7 -> 5, >= 3 -> 3, else 2
 *
 * Fixed here: a repeated call on the SAME day previously still awarded points
 * on every call (unbounded farming). Same-day activity now changes nothing
 * and awards nothing.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** ISO date (YYYY-MM-DD) of last activity, or null */
  lastActivityDate: string | null;
}

export interface StreakUpdate {
  newStreak: number;
  newLongestStreak: number;
  /** Points to award for this activity (0 when nothing changed). */
  pointsEarned: number;
  /** Whether the streak row should be written. */
  changed: boolean;
}

export function toDateKey(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split("T")[0];
}

export function pointsForStreak(streak: number): number {
  if (streak >= 7) return 5;
  if (streak >= 3) return 3;
  return 2;
}

export function computeStreakUpdate(state: StreakState, activityDate: Date): StreakUpdate {
  const today = new Date(activityDate);
  today.setHours(0, 0, 0, 0);

  const { currentStreak, longestStreak, lastActivityDate } = state;
  let newStreak = currentStreak;
  let newLongestStreak = longestStreak;

  if (lastActivityDate) {
    const last = new Date(lastActivityDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day: no change, no points (this is the farming fix).
      return { newStreak: currentStreak, newLongestStreak: longestStreak, pointsEarned: 0, changed: false };
    } else if (diffDays === 1) {
      newStreak = currentStreak + 1;
      if (newStreak > longestStreak) newLongestStreak = newStreak;
    } else if (diffDays >= 2 && diffDays <= 3) {
      newStreak = currentStreak;
    } else {
      newStreak = 1;
      if (newStreak > longestStreak) newLongestStreak = newStreak;
    }
  } else {
    newStreak = 1;
    newLongestStreak = Math.max(longestStreak, 1);
  }

  return { newStreak, newLongestStreak, pointsEarned: pointsForStreak(newStreak), changed: true };
}
