// app/api/admin/gamification/stats/route.ts
// إحصائيات Gamification للأدمين

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(async (request) => {
  await requireAdmin(request);

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
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
});