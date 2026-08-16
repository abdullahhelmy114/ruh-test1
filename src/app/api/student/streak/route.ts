// app/api/student/streak/route.ts
// جلب أو تحديث سلسلة الأيام المتتالية (Streak) للطالب

import { NextResponse } from "next/server";
import { getStreak, updateStreak } from "@/lib/gamification/streaks";
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
    const streak = await getStreak(userId);
    return NextResponse.json({ streak });
  } catch (error: any) {
    console.error("Error fetching streak:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch streak" },
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
    const streak = await updateStreak(userId);
    return NextResponse.json({ success: true, streak });
  } catch (error: any) {
    console.error("Error updating streak:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update streak" },
      { status: 500 }
    );
  }
}