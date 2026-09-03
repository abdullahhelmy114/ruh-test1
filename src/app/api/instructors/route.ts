import { NextResponse } from "next/server";
import { db } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        name,
        credentials,
        specialty,
        accent_color AS "accentColor",
        video_preview_url AS "videoPreviewUrl"
      FROM instructors
      WHERE is_active = true
      ORDER BY display_order ASC, created_at DESC
    `);

    return NextResponse.json({ instructors: rows });
  } catch (error) {
    console.error("Failed to fetch instructors:", error);
    return NextResponse.json(
      { error: "Unable to load instructors" },
      { status: 500 }
    );
  }
}