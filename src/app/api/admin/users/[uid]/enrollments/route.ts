import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.1: unauthenticated IDOR on any user's enrollment history. Admin
// session required; `uid` in the path is the TARGET user, never the caller.
// Next 16: params is a Promise and must be awaited.
export const GET = withApi<{ uid: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const { uid } = await ctx.params;

  // جلب الاشتراكات من جدول enrollments مع عنوان الدورة
  const enrollments = await sql`
    SELECT e.id, e.user_uid, e.course_id, c.title AS course_title, e.enrolled_at
    FROM enrollments e
    JOIN course c ON e.course_id = c.id
    WHERE e.user_uid = ${uid}
    ORDER BY e.enrolled_at DESC
  `;

  return NextResponse.json(enrollments);
});
