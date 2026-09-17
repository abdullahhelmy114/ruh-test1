import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireTeacher } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// The signed-in teacher's live courses.
// Teacher lifecycle: central guard (active teacher accounts only) instead of
// getServerSession and a local role check.
export const GET = withApi(async (req) => {
  const session = await requireTeacher(req);

  const course = await sql`
    SELECT lc.id, lc.title, lc.level, lc.price, lc.status
    FROM live_course lc
    JOIN profiles p ON lc.teacher_uid = p.firebase_uid
    WHERE p.firebase_uid = ${session.uid}
    ORDER BY lc.created_at DESC
  `;
  return NextResponse.json({ course });
});
