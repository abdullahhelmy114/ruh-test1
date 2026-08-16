// src/lib/gamification/badges.ts
// إدارة الشارات: تعريفات، منح تلقائي، شارات مخصصة، جلب شارات المستخدم

import { Pool } from "@neondatabase/serverless";

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

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  condition_type: string;
  condition_value: number | null;
  is_custom: boolean;
}

export interface UserBadge {
  id: string;           // user_badges id
  badge_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  awarded_at: string;
}

/**
 * جلب جميع تعريفات الشارات
 */
export async function getAllBadges(): Promise<BadgeDefinition[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT id, name, description, icon_url, condition_type, condition_value, is_custom
       FROM badges
       ORDER BY is_custom, name`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon_url: row.icon_url,
      condition_type: row.condition_type,
      condition_value: row.condition_value,
      is_custom: row.is_custom,
    }));
  } catch (error) {
    console.error("Failed to get badges:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * جلب شارات مستخدم معين مع تفاصيلها
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT ub.id, ub.badge_id, b.name, b.description, b.icon_url, ub.awarded_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.awarded_at DESC`,
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      badge_id: row.badge_id,
      name: row.name,
      description: row.description,
      icon_url: row.icon_url,
      awarded_at: row.awarded_at.toISOString(),
    }));
  } catch (error) {
    console.error("Failed to get user badges:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * إنشاء شارة مخصصة (بواسطة الأدمين)
 */
export async function createCustomBadge(
  name: string,
  description: string | null,
  icon_url: string | null,
  condition_type: string,
  condition_value: number | null
): Promise<string> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `INSERT INTO badges (name, description, icon_url, condition_type, condition_value, is_custom)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [name, description, icon_url, condition_type, condition_value]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error("Failed to create custom badge:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * حذف شارة (مخصصة أو افتراضية) مع حذف منحها للمستخدمين
 */
export async function deleteBadge(badgeId: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("DELETE FROM user_badges WHERE badge_id = $1", [badgeId]);
    await client.query("DELETE FROM badges WHERE id = $1", [badgeId]);
  } catch (error) {
    console.error("Failed to delete badge:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * التحقق من شرط معين وإرجاع القيمة الفعلية من قاعدة البيانات
 * @param userId معرّف المستخدم
 * @param conditionType نوع الشرط (مثل "points_reached", "streak_days", ...)
 * @returns القيمة الحالية التي سيتم مقارنتها مع condition_value
 */
async function getConditionValue(userId: string, conditionType: string): Promise<number> {
  const client = await getPool().connect();
  try {
    switch (conditionType) {
      case "course_completed":
        {
          const res = await client.query(
            `SELECT COUNT(*)::int AS count FROM course_completions WHERE user_uid = $1`,
            [userId]
          );
          return res.rows[0]?.count || 0;
        }
      case "level_mastered":
        {
          // نعتبر إكمال أي كورس هو إتقان مستوى، ويمكن تحسينه لاحقاً
          const res = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM enrollments e
             WHERE e.user_uid = $1 AND e.completed = true`,
            [userId]
          );
          return res.rows[0]?.count || 0;
        }
      case "points_reached":
        {
          const res = await client.query(
            `SELECT balance FROM user_points WHERE user_id = $1`,
            [userId]
          );
          return res.rows[0]?.balance || 0;
        }
      case "streak_days":
        {
          const res = await client.query(
            `SELECT current_streak FROM streaks WHERE user_id = $1`,
            [userId]
          );
          return res.rows[0]?.current_streak || 0;
        }
      case "questions_completed":
        {
          const res = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM activity_log
             WHERE user_id = $1 AND activity_type = 'question_answered'`,
            [userId]
          );
          return res.rows[0]?.count || 0;
        }
      case "game_won":
        {
          const res = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM activity_log
             WHERE user_id = $1 AND activity_type = 'game_won'`,
            [userId]
          );
          return res.rows[0]?.count || 0;
        }
      default:
        return 0;
    }
  } catch (error) {
    console.error(`Failed to get condition value for ${conditionType}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * التحقق من جميع الشارات التلقائية ومنح المستحق منها.
 * يُستدعى بعد الأحداث الهامة (إجابة سؤال، إكمال كورس، إلخ).
 * يمكن استدعاؤه دورياً أو عند الحاجة.
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const client = await getPool().connect();
  const awardedBadgeIds: string[] = [];

  try {
    // جلب جميع الشارات
    const badgesResult = await client.query(
      `SELECT id, condition_type, condition_value FROM badges WHERE is_custom = false`
    );

    // جلب الشارات الممنوحة مسبقاً
    const existingResult = await client.query(
      `SELECT badge_id FROM user_badges WHERE user_id = $1`,
      [userId]
    );
    const existingBadgeIds = new Set(existingResult.rows.map((r) => r.badge_id));

    for (const badge of badgesResult.rows) {
      const badgeId = badge.id;
      if (existingBadgeIds.has(badgeId)) continue;

      const conditionType = badge.condition_type;
      const conditionValue = badge.condition_value;

      // التحقق من الشرط
      const actualValue = await getConditionValue(userId, conditionType);

      if (actualValue >= conditionValue) {
        // منح الشارة
        await client.query(
          `INSERT INTO user_badges (user_id, badge_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_id) DO NOTHING`,
          [userId, badgeId]
        );
        awardedBadgeIds.push(badgeId);
      }
    }

    return awardedBadgeIds;
  } catch (error) {
    console.error("Failed to check and award badges:", error);
    throw error;
  } finally {
    client.release();
  }
}