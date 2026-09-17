// app/api/admin/gamification/points-config/route.ts
// إدارة إعدادات النقاط وعروض الاستبدال (للأدمين)

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const configRes = await sql`SELECT key_name, value FROM gamification_config`;
    const config: Record<string, string> = {};
    for (const row of configRes) {
      config[row.key_name] = row.value;
    }

    const offersRes = await sql`SELECT id, points_cost, discount_percent, description, is_active FROM redemption_offers ORDER BY points_cost ASC`;

    return NextResponse.json({
      config,
      offers: offersRes,
    });
  } catch (error: any) {
    console.error("Error fetching gamification config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }
});

export const PUT = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const updates: Record<string, number> = {};

    if (typeof body.daily_streak_2 === "number") updates.daily_streak_2 = body.daily_streak_2;
    if (typeof body.daily_streak_3 === "number") updates.daily_streak_3 = body.daily_streak_3;
    if (typeof body.daily_streak_5 === "number") updates.daily_streak_5 = body.daily_streak_5;
    if (typeof body.exam_pass_points === "number") updates.exam_pass_points = body.exam_pass_points;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    for (const [key, value] of Object.entries(updates)) {
      await sql`
        INSERT INTO gamification_config (key_name, value)
        VALUES (${key}, ${value.toString()})
        ON CONFLICT (key_name) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating gamification config:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
});