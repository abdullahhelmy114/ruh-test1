// src/lib/gamification/redemption.ts
// استبدال النقاط بكوبونات خصم (Redemption)

import { Pool } from "@neondatabase/serverless";
import { getPointsBalance, deductPoints } from "./points";

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

export interface RedemptionOffer {
  id: string;
  points_cost: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
}

export interface RedeemedCoupon {
  coupon_id: string;
  code: string;
  discount_percent: number;
  points_cost: number;
  message: string;
}

/**
 * توليد رمز كوبون فريد
 */
function generateCouponCode(discountPercent: number): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `POINTS-${randomPart}-${discountPercent}%`;
}

/**
 * جلب العروض النشطة لاستبدال النقاط
 */
export async function getActiveRedemptionOffers(): Promise<RedemptionOffer[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT id, points_cost, discount_percent, description, is_active
       FROM redemption_offers
       WHERE is_active = true
       ORDER BY points_cost ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      points_cost: row.points_cost,
      discount_percent: row.discount_percent,
      description: row.description,
      is_active: row.is_active,
    }));
  } catch (error) {
    console.error("Failed to get redemption offers:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * استبدال النقاط بكوبون خصم
 * @param userId معرّف المستخدم (UUID)
 * @param offerId معرّف عرض الاستبدال
 * @returns معلومات الكوبون المُنشأ
 * @throws Error إذا كانت النقاط غير كافية أو العرض غير نشط
 */
export async function redeemPointsForCoupon(
  userId: string,
  offerId: string
): Promise<RedeemedCoupon> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // جلب العرض المطلوب
    const offerResult = await client.query(
      `SELECT id, points_cost, discount_percent, is_active
       FROM redemption_offers
       WHERE id = $1
       FOR UPDATE`,
      [offerId]
    );

    if (offerResult.rows.length === 0) {
      throw new Error("Redemption offer not found");
    }

    const offer = offerResult.rows[0];
    if (!offer.is_active) {
      throw new Error("Redemption offer is not active");
    }

    // التحقق من رصيد النقاط
    const balance = await getPointsBalance(userId);
    if (balance < offer.points_cost) {
      throw new Error("Insufficient points balance");
    }

    // خصم النقاط
    const deducted = await deductPoints(
      userId,
      offer.points_cost,
      "redeem_coupon",
      { offer_id: offerId, discount_percent: offer.discount_percent }
    );
    if (!deducted) {
      throw new Error("Failed to deduct points");
    }

    // توليد كوبون فريد
    let code = generateCouponCode(offer.discount_percent);
    // ضمان عدم التكرار
    let attempts = 0;
    while (attempts < 5) {
      const existing = await client.query(
        `SELECT id FROM coupons WHERE code = $1`,
        [code]
      );
      if (existing.rows.length === 0) break;
      code = generateCouponCode(offer.discount_percent);
      attempts++;
    }

    // إدراج الكوبون في جدول coupons (نفترض وجود الأعمدة الأساسية)
    // يجب أن تتوافق مع هيكل الجدول الحالي لديك
    // إذا كانت هناك أعمدة إضافية مطلوبة، يمكن تعديل الاستعلام
    const couponResult = await client.query(
      `INSERT INTO coupons (code, discount_percent, max_uses, current_uses, valid_until, created_by_user_id, is_points_redeemed, points_cost, is_used)
       VALUES ($1, $2, 1, 0, NOW() + INTERVAL '30 days', $3, true, $4, false)
       RETURNING id, code, discount_percent`,
      [code, offer.discount_percent, userId, offer.points_cost]
    );

    await client.query("COMMIT");

    const coupon = couponResult.rows[0];
    return {
      coupon_id: coupon.id,
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      points_cost: offer.points_cost,
      message: `Successfully redeemed ${offer.points_cost} points for a ${offer.discount_percent}% discount coupon.`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to redeem points:", error);
    throw error;
  } finally {
    client.release();
  }
}