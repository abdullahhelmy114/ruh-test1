// app/api/admin/gamification/offers/route.ts
// إدارة عروض استبدال النقاط (Redemption Offers)

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const GET = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const offers = await sql`
      SELECT id, points_cost, discount_percent, description, is_active
      FROM redemption_offers
      ORDER BY points_cost ASC
    `;
    return NextResponse.json({ offers });
  } catch (error: any) {
    console.error("Error fetching offers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch offers" },
      { status: 500 }
    );
  }
});

export const POST = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { points_cost, discount_percent, description } = body;

    if (!points_cost || points_cost <= 0 || !discount_percent || discount_percent <= 0) {
      return NextResponse.json(
        { error: "Invalid points_cost or discount_percent" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO redemption_offers (points_cost, discount_percent, description)
      VALUES (${points_cost}, ${discount_percent}, ${description || null})
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0].id });
  } catch (error: any) {
    console.error("Error creating offer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create offer" },
      { status: 500 }
    );
  }
});

export const PUT = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { offerId, is_active } = body;

    if (!offerId || typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "offerId and is_active are required" },
        { status: 400 }
      );
    }

    await sql`
      UPDATE redemption_offers
      SET is_active = ${is_active}
      WHERE id = ${offerId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating offer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update offer" },
      { status: 500 }
    );
  }
});

export const DELETE = withApi(async (request) => {
  await requireAdmin(request);

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { offerId } = body;

    if (!offerId) {
      return NextResponse.json(
        { error: "offerId is required" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM redemption_offers WHERE id = ${offerId}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting offer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete offer" },
      { status: 500 }
    );
  }
});