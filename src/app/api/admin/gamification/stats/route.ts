// app/api/admin/gamification/stats/route.ts
// إحصائيات Gamification للأدمين

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const totalUsersResult = await sql`SELECT COUNT(*)::int AS count FROM profiles`;
    const totalPointsResult = await sql`SELECT COALESCE(SUM(balance), 0)::int AS total FROM user_points`;
    const totalBadgesAwardedResult = await sql`SELECT COUNT(*)::int AS count FROM user_badges`;
    const activeStreaksResult = await sql`SELECT COUNT(*)::int AS count FROM streaks WHERE current_streak >= 7`;
    const totalRedemptionsResult = await sql`SELECT COUNT(*)::int AS count FROM coupons WHERE is_points_redeemed = true`;

    const topStudentsResult = await sql`
      SELECT p.full_name, p.email, up.balance
      FROM user_points up
      JOIN profiles p ON p.id = up.user_id
      ORDER BY up.balance DESC
      LIMIT 10
    `;

    return NextResponse.json({
      stats: {
        total_users: totalUsersResult[0]?.count || 0,
        total_points: totalPointsResult[0]?.total || 0,
        total_badges_awarded: totalBadgesAwardedResult[0]?.count || 0,
        active_streaks_7plus: activeStreaksResult[0]?.count || 0,
        total_redemptions: totalRedemptionsResult[0]?.count || 0,
      },
      top_students: topStudentsResult,
    });
  } catch (error: any) {
    console.error("Error fetching gamification stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}