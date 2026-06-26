import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(req: Request) {
  const teacherId = 'current-teacher-id'; // استخراج من الجلسة لاحقًا
  const earnings = await sql`
    SELECT te.*, pc.course_id, c.title as course_title
    FROM teacher_earnings te
    JOIN purchase_courses pc ON te.purchase_course_id = pc.id
    JOIN courses c ON pc.course_id = c.id
    WHERE te.teacher_id = ${teacherId}
    ORDER BY te.id DESC
  `;
  return NextResponse.json(earnings || []);
}
