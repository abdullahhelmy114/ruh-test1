// app/api/student/redeem-points/route.ts
// استبدال النقاط بكوبون خصم

import { NextResponse } from "next/server";
import { redeemPointsForCoupon, getActiveRedemptionOffers } from "@/lib/gamification/redemption";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { neon } from "@neondatabase/serverless";

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT id FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 ? result[0].id : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const offers = await getActiveRedemptionOffers();
    return NextResponse.json({ offers });
  } catch (error: any) {
    console.error("Error fetching redemption offers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { offerId } = body;

    if (!offerId) {
      return NextResponse.json(
        { error: "offerId is required" },
        { status: 400 }
      );
    }

    const coupon = await redeemPointsForCoupon(userId, offerId);
    return NextResponse.json({ success: true, coupon });
  } catch (error: any) {
    console.error("Error redeeming points:", error);
    return NextResponse.json(
      { error: error.message || "Failed to redeem points" },
      { status: 400 }
    );
  }
}