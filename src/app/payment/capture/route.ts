import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function getUserIdFromRequest(
  request: Request
): Promise<{ id: string; firebase_uid: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      SELECT id, firebase_uid
      FROM profiles
      WHERE firebase_uid = ${decoded.uid}
      LIMIT 1
    `;
    return result.length > 0
      ? { id: result[0].id, firebase_uid: result[0].firebase_uid }
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userRow = await getUserIdFromRequest(request);
  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userRow.id;
  const firebaseUid = userRow.firebase_uid;
  const { course_id, amount } = await request.json();

  if (!course_id || !amount) {
    return NextResponse.json(
      { error: "course_id and amount are required" },
      { status: 400 }
    );
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    // 1) جلب بيانات الطالب: هل أتى من إحالة؟ هل استخدم خصمه؟
    const profileRes = await sql`
      SELECT
        referral_discount_used,
        referred_by
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (profileRes.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = profileRes[0];
    let finalAmount = amount;

    // 2) تطبيق خصم 15% للطالب الجديد القادم من إحالة (مرة واحدة فقط)
    if (!profile.referral_discount_used && profile.referred_by) {
      finalAmount = Math.round(amount * 0.85 * 100) / 100; // خصم 15%

      await sql`
        UPDATE profiles
        SET referral_discount_used = true
        WHERE id = ${userId}
      `;
    }

    // 3) تسجيل عملية الشراء (الدفع تم تأكيده)
    await sql`
      INSERT INTO purchases (
        user_uid,
        course_id,
        amount,
        final_amount,
        status,
        created_at
      ) VALUES (
        ${firebaseUid},
        ${course_id},
        ${amount},
        ${finalAmount},
        'confirmed',
        NOW()
      )
    `;

    // 4) تسجيل الطالب في الكورس
    await sql`
      INSERT INTO enrollments (
        user_uid,
        course_id,
        completed,
        created_at
      ) VALUES (
        ${firebaseUid},
        ${course_id},
        false,
        NOW()
      )
    `;

    // 5) منح المُحيل 15% من المبلغ الفعلي المدفوع
    if (profile.referred_by) {
      const reward = Math.round(finalAmount * 0.15 * 100) / 100;

      await sql`
        UPDATE profiles
        SET
          referral_credits = COALESCE(referral_credits, 0) + ${reward},
          referral_count = COALESCE(referral_count, 0) + 1
        WHERE id = ${profile.referred_by}
      `;
    }

    return NextResponse.json({
      success: true,
      amount: finalAmount,
      discount_applied: finalAmount < amount,
    });
  } catch (error: any) {
    console.error("Payment capture error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process payment" },
      { status: 500 }
    );
  }
}