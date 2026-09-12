// src/lib/gamification/streaks.ts
// إدارة سلسلة الأيام المتتالية (Streak) وربطها بالنقاط

import { Pool } from "@neondatabase/serverless";
import { addPoints } from "./points";
import { computeStreakUpdate, toDateKey } from "./streak-rules";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in environment variables");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  last_updated: string;
}

/**
 * تحديث السلسلة اليومية عند قيام المستخدم بنشاط ناجح.
 * القواعد (بدون تغيير) موجودة في streak-rules.ts:
 * - اليوم التالي: تزداد السلسلة. فجوة 2–3 أيام: تُحفظ. أكثر من 3 أيام: تعود إلى 1.
 * - النقاط حسب طول السلسلة (2, 3, 5).
 *
 * Phase 2.4a: تكرار النداء في نفس اليوم لا يغيّر السلسلة ولا يمنح نقاطاً
 * (كان يمنح نقاطاً في كل نداء).
 *
 * @param userId معرّف المستخدم في جدول profiles
 * @param activityDate تاريخ النشاط
 */
export async function updateStreak(
  userId: string,
  activityDate: Date = new Date()
): Promise<StreakInfo> {
  if (!userId) throw new Error("User ID is required");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // جلب بيانات السلسلة الحالية (مع قفل الصف)
    const result = await client.query(
      `SELECT current_streak, longest_streak, last_activity_date
       FROM streaks
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    const existing = result.rows.length > 0 ? result.rows[0] : null;
    const update = computeStreakUpdate(
      {
        currentStreak: existing ? existing.current_streak : 0,
        longestStreak: existing ? existing.longest_streak : 0,
        lastActivityDate: existing?.last_activity_date ? toDateKey(new Date(existing.last_activity_date)) : null,
      },
      activityDate
    );
    const todayKey = toDateKey(activityDate);

    if (!update.changed) {
      // نفس اليوم: لا تغيير ولا نقاط
      await client.query("COMMIT");
      return {
        current_streak: update.newStreak,
        longest_streak: update.newLongestStreak,
        last_activity_date: todayKey,
        last_updated: new Date().toISOString(),
      };
    }

    // إدراج أو تحديث السلسلة
    if (!existing) {
      await client.query(
        `INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date, last_updated)
         VALUES ($1, $2, $3, $4, now())`,
        [userId, update.newStreak, update.newLongestStreak, todayKey]
      );
    } else {
      await client.query(
        `UPDATE streaks
         SET current_streak = $1,
             longest_streak = $2,
             last_activity_date = $3,
             last_updated = now()
         WHERE user_id = $4`,
        [update.newStreak, update.newLongestStreak, todayKey, userId]
      );
    }

    // منح النقاط إذا كانت > 0
    if (update.pointsEarned > 0) {
      await addPoints(userId, update.pointsEarned, "daily_activity", {
        streak: update.newStreak,
        date: todayKey,
      });
    }

    await client.query("COMMIT");

    return {
      current_streak: update.newStreak,
      longest_streak: update.newLongestStreak,
      last_activity_date: todayKey,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to update streak:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * جلب حالة السلسلة الحالية للمستخدم
 */
export async function getStreak(userId: string): Promise<StreakInfo | null> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT current_streak, longest_streak, last_activity_date, last_updated
       FROM streaks
       WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      current_streak: row.current_streak,
      longest_streak: row.longest_streak,
      last_activity_date: row.last_activity_date ? row.last_activity_date.toISOString().split("T")[0] : null,
      last_updated: row.last_updated.toISOString(),
    };
  } catch (error) {
    console.error("Failed to get streak:", error);
    throw error;
  } finally {
    client.release();
  }
}
