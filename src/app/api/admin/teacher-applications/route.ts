import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.1: pending teachers' contact details (phone, Telegram, CV,
// nationality, gender) were readable without authentication. Admin session
// required. Column list and array response shape unchanged: the admin
// teacher-verification page renders these fields.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const teachers = await sql`
    SELECT firebase_uid, email, full_name, country_of_residence, nationality, gender,
           languages, whatsapp, telegram, social_links, bio, cv_url, intro_video_url, created_at
    FROM profiles
    WHERE role = 'teacher' AND status = 'pending'
    ORDER BY created_at DESC
  `;
  return NextResponse.json(teachers);
});
