// app/api/admin/gamification/badges/route.ts
// إدارة الشارات (إنشاء، عرض، حذف) من قبل الأدمين

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
    const badges = await sql`SELECT id, name, description, icon_url, condition_type, condition_value, is_custom FROM badges ORDER BY is_custom, name`;
    return NextResponse.json({ badges });
  } catch (error: any) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch badges" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { name, description, icon_url, condition_type, condition_value } = body;

    if (!name || !condition_type || condition_value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, condition_type, condition_value" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO badges (name, description, icon_url, condition_type, condition_value, is_custom)
      VALUES (${name}, ${description || null}, ${icon_url || null}, ${condition_type}, ${condition_value}, true)
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0].id });
  } catch (error: any) {
    console.error("Error creating badge:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create badge" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { badgeId } = body;

    if (!badgeId) {
      return NextResponse.json({ error: "badgeId is required" }, { status: 400 });
    }

    await sql`DELETE FROM user_badges WHERE badge_id = ${badgeId}`;
    await sql`DELETE FROM badges WHERE id = ${badgeId}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting badge:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete badge" },
      { status: 500 }
    );
  }
}