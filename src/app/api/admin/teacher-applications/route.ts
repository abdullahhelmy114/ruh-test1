import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const teachers = await sql`
      SELECT uid, email, first_name, last_name, country_of_residence, nationality, gender,
             languages, whatsapp, telegram, social_links, bio, cv_url, intro_video_url, created_at
      FROM users
      WHERE role = 'teacher' AND status = 'pending'
      ORDER BY created_at DESC
    `;
    return NextResponse.json(teachers);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}