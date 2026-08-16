// src/lib/gamification/points.ts
// إدارة النقاط: إضافة، خصم، جلب الرصيد، سجل الحركات

import { Pool } from "@neondatabase/serverless";

// إنشاء اتصال مشترك مع Neon
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

export interface PointsLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * إضافة نقاط للمستخدم مع تسجيل الحركة
 * @param userId معرّف المستخدم في جدول profiles (UUID)
 * @param amount عدد النقاط (موجب)
 * @param reason سبب الإضافة (مثل "daily_activity")
 * @param metadata بيانات إضافية اختيارية
 */
export async function addPoints(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!userId) throw new Error("User ID is required");
  if (amount <= 0) throw new Error("Amount must be positive");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // تحديث الرصيد (أو إنشاؤه إذا لم يوجد)
    await client.query(
      `INSERT INTO user_points (user_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET balance = user_points.balance + EXCLUDED.balance,
                     updated_at = now()`,
      [userId, amount]
    );

    // تسجيل الحركة في السجل
    await client.query(
      `INSERT INTO points_ledger (user_id, amount, reason, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, amount, reason, metadata ? JSON.stringify(metadata) : null]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to add points:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * خصم نقاط من المستخدم (لا يسمح بالرصيد السالب)
 * @param userId معرّف المستخدم
 * @param amount عدد النقاط (موجب)
 * @param reason سبب الخصم
 * @param metadata بيانات إضافية
 */
export async function deductPoints(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (!userId) throw new Error("User ID is required");
  if (amount <= 0) throw new Error("Amount must be positive");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // التحقق من الرصيد الحالي وقفل الصف
    const balanceResult = await client.query(
      `SELECT balance FROM user_points WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    const currentBalance = balanceResult.rows[0]?.balance ?? 0;
    if (currentBalance < amount) {
      await client.query("ROLLBACK");
      return false; // لا يكفي الرصيد
    }

    // خصم الرصيد
    await client.query(
      `UPDATE user_points
       SET balance = balance - $1,
           updated_at = now()
       WHERE user_id = $2`,
      [amount, userId]
    );

    // تسجيل الحركة بالسالب
    await client.query(
      `INSERT INTO points_ledger (user_id, amount, reason, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, -amount, reason, metadata ? JSON.stringify(metadata) : null]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to deduct points:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * جلب الرصيد الحالي لنقاط المستخدم
 * @param userId معرّف المستخدم
 * @returns الرصيد (عدد صحيح)
 */
export async function getPointsBalance(userId: string): Promise<number> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT balance FROM user_points WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.balance ?? 0;
  } catch (error) {
    console.error("Failed to get points balance:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * جلب سجل حركات النقاط للمستخدم
 * @param userId معرّف المستخدم
 * @param limit عدد السجلات (افتراضي 50)
 * @returns قائمة بالسجلات مرتبة تنازلياً حسب التاريخ
 */
export async function getPointsHistory(
  userId: string,
  limit: number = 50
): Promise<PointsLedgerEntry[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT id, user_id, amount, reason, metadata, created_at
       FROM points_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      amount: row.amount,
      reason: row.reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error("Failed to get points history:", error);
    throw error;
  } finally {
    client.release();
  }
}