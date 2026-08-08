export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.teacher_uid = ${uid}) AS totalStudents,
        (SELECT COUNT(*) FROM courses WHERE teacher_uid = ${uid}) AS totalCourses,
        (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE teacher_uid = ${uid}) AS totalRevenue,
        (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE teacher_uid = ${uid}) AS averageRating
    `;

    const studentsOverTime = await sql`
      SELECT TO_CHAR(enrolled_at, 'Mon') AS month, COUNT(*) AS count
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE c.teacher_uid = ${uid}
      GROUP BY month ORDER BY MIN(enrolled_at)
    `;

    const revenueByCourse = await sql`
      SELECT c.title AS name, COALESCE(SUM(t.amount),0) AS value
      FROM transactions t JOIN courses c ON t.course_id = c.id
      WHERE t.teacher_uid = ${uid}
      GROUP BY c.title
    `;

    const [completion] = await sql`
      SELECT ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / GREATEST(COUNT(*),1), 0) AS rate
      FROM progress p JOIN courses c ON p.course_id = c.id
      WHERE c.teacher_uid = ${uid}
    `;

    return NextResponse.json({
      totalStudents: stats?.totalStudents || 0,
      totalCourses: stats?.totalCourses || 0,
      totalRevenue: stats?.totalRevenue || 0,
      averageRating: stats?.averageRating || 0,
      studentsOverTime: studentsOverTime || [],
      revenueByCourse: revenueByCourse || [],
      completionRate: completion?.rate || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}