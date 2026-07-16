import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    // جلب الاشتراكات من جدول enrollments مع عنوان الدورة
    const enrollments = await sql`
      SELECT e.id, e.user_uid, e.course_id, c.title AS course_title, e.enrolled_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_uid = ${params.uid}
      ORDER BY e.enrolled_at DESC
    `;

    return NextResponse.json(enrollments);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}