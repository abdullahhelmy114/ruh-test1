// app/api/student/points/route.ts
// جلب رصيد النقاط وسجل الحركات للطالب

import { NextResponse } from "next/server";
import { getPointsBalance, getPointsHistory } from "@/lib/gamification/points";
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
    const balance = await getPointsBalance(userId);
    const history = await getPointsHistory(userId, 20);
    return NextResponse.json({ balance, history });
  } catch (error: any) {
    console.error("Error fetching points:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch points" },
      { status: 500 }
    );
  }
}