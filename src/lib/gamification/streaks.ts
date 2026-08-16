// src/lib/gamification/streaks.ts
// إدارة سلسلة الأيام المتتالية (Streak) وربطها بالنقاط

import { Pool } from "@neondatabase/serverless";
import { addPoints } from "./points";

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
 * - إذا كان النشاط في نفس اليوم (حسب المنطقة الزمنية للخادم) لا يتغير شيء.
 * - إذا كان النشاط في اليوم التالي، تزداد السلسلة.
 * - إذا مر أكثر من 3 أيام بدون نشاط، تعود السلسلة إلى 1.
 * - يمنح نقاطاً حسب طول السلسلة (2, 3, 5 يومياً).
 *
 * @param userId معرّف المستخدم في جدول profiles
 * @param activityDate تاريخ النشاط (يمكن تمرير new Date() أو تاريخ محدد)
 * @returns معلومات السلسلة بعد التحديث
 */
export async function updateStreak(
  userId: string,
  activityDate: Date = new Date()
): Promise<StreakInfo> {
  if (!userId) throw new Error("User ID is required");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // جلب بيانات السلسلة الحالية
    const result = await client.query(
      `SELECT current_streak, longest_streak, last_activity_date
       FROM streaks
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    // حساب تاريخ اليوم (بتوقيت الخادم UTC)
    const today = new Date(activityDate);
    today.setHours(0, 0, 0, 0);

    let currentStreak = result.rows.length > 0 ? result.rows[0].current_streak : 0;
    let longestStreak = result.rows.length > 0 ? result.rows[0].longest_streak : 0;
    let lastActivityDate: Date | null = result.rows.length > 0 && result.rows[0].last_activity_date
      ? new Date(result.rows[0].last_activity_date)
      : null;

    let pointsEarned = 0;
    let newStreak = currentStreak;
    let newLongestStreak = longestStreak;

    if (lastActivityDate) {
      // حساب الفرق بالأيام بين آخر نشاط واليوم
      const diffDays = Math.floor(
        (today.getTime() - new Date(lastActivityDate).setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        // نفس اليوم: لا تغيير في السلسلة، لا نقاط إضافية
        // (لكن يمكن أن يكون النشاط الثاني في اليوم لا يمنح نقاطاً إضافية)
        // نكتفي بإرجاع البيانات الحالية
      } else if (diffDays === 1) {
        // اليوم التالي: زيادة السلسلة
        newStreak = currentStreak + 1;
        if (newStreak > longestStreak) newLongestStreak = newStreak;
      } else if (diffDays >= 2 && diffDays <= 3) {
        // مرت أكثر من يوم واحد ولكن أقل من 3 أيام: السلسلة تستمر من 1؟
        // حسب القاعدة: "الاستريك يقدر يضيع أكثر شئ 3 أيام حتى لو متقطعه"
        // نعتبر أن الانقطاع > 3 أيام يعيد للسلسلة، لكن الفجوة 2-3 أيام قد تستمر؟
        // القاعدة الأصلية: إذا فشل (مرت 3 أيام بدون نشاط) يتعاد.
        // نعتبر هنا أن النشاط الجديد بعد انقطاع >1 يوم و <=3 أيام يستأنف السلسلة بدون زيادة اليوم السابق؟
        // تبسيطاً: نعيد السلسلة إلى 1، لأن النشاط لم يكن متواصلاً يومياً.
        // لكن لتوافق مع القاعدة "حتى لو متقطعه" نسمح بالفجوة 2-3 أيام كاستمرار؟ 
        // نقرر: نسمح بفجوة تصل إلى 3 أيام كاستمرار (أي لا نفقد السلسلة) ولكن لا نزيد اليوم المفقود.
        // لكن النقاط تحسب على السلسلة الحالية.
        // سنتركها بسيطة: نتعامل مع أي فجوة > 1 يوم كإعادة ضبط.
        // نستخدم الشرح: "لو فشل يتعاد تاني" عند مرور 3 أيام.
        // لذا: إذا مر > 3 أيام -> إعادة ضبط. إذا مر 2-3 أيام -> نحافظ على السلسلة (لا نزيدها، لكن لا نعيدها).
        // لكن هل يمنح نقاطاً عن اليوم؟ نعم، لأن النشاط حدث.
        // سنحسب النقاط بناءً على السلسلة الحالية قبل التحديث أو بعدها؟
        // القاعدة: اليوم الأول والثاني: 2 نقطة، من الثالث للسادس: 3 نقاط، من السابع: 5 نقاط.
        // سنحسب النقاط على أساس السلسلة الحالية بعد التحديث.
        // إذا حافظنا على السلسلة بدون زيادة، نعطي نفس نقاط اليوم السابق؟ 
        // لكن القاعدة تقول "يوميا" حسب السلسلة، فإذا كانت السلسلة 4 مثلاً وفجوة يومين، هل نعطي 3 نقاط كاليوم الرابع؟ 
        // نعم، نعطي نقاط السلسلة الحالية.
        // نزيد السلسلة إذا مر يوم واحد فقط بالضبط. في الفجوات الأكبر نحافظ على نفس السلسلة (لا زيادة) ونعطي نقاط حسبها.
        newStreak = currentStreak;
        // لكن قد يكون الفرق 2-3 أيام، نعطي نقاط اليوم الحالي بنفس مستوى السلسلة
      } else {
        // diffDays > 3 أو سالب (خطأ في التاريخ): نعيد التعيين
        newStreak = 1;
        if (newStreak > longestStreak) newLongestStreak = newStreak;
      }
    } else {
      // لا يوجد سجل سابق: بداية سلسلة جديدة
      newStreak = 1;
      newLongestStreak = Math.max(longestStreak, 1);
    }

    // حساب النقاط بناءً على السلسلة الجديدة
    if (newStreak >= 7) {
      pointsEarned = 5;
    } else if (newStreak >= 3) {
      pointsEarned = 3;
    } else {
      pointsEarned = 2;
    }

    // إدراج أو تحديث السلسلة
    if (result.rows.length === 0) {
      await client.query(
        `INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date, last_updated)
         VALUES ($1, $2, $3, $4, now())`,
        [userId, newStreak, newLongestStreak, today.toISOString().split("T")[0]]
      );
    } else {
      await client.query(
        `UPDATE streaks
         SET current_streak = $1,
             longest_streak = $2,
             last_activity_date = $3,
             last_updated = now()
         WHERE user_id = $4`,
        [newStreak, newLongestStreak, today.toISOString().split("T")[0], userId]
      );
    }

    // منح النقاط إذا كانت > 0
    if (pointsEarned > 0) {
      await addPoints(userId, pointsEarned, "daily_activity", {
        streak: newStreak,
        date: today.toISOString().split("T")[0],
      });
    }

    await client.query("COMMIT");

    return {
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      last_activity_date: today.toISOString().split("T")[0],
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