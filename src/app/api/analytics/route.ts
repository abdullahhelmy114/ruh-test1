import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the teacher whose analytics are returned is the verified caller.
// An admin may explicitly target another teacher with ?uid=. Edge runtime
// removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);
  const requested = new URL(req.url).searchParams.get('uid');
  const uid = user.role === 'admin' && requested ? requested : user.uid;

  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM enrollments e JOIN course c ON e.course_id = c.id WHERE c.teacher_uid = ${uid}) AS totalStudents,
      (SELECT COUNT(*) FROM course WHERE teacher_uid = ${uid}) AS totalcourse,
      (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE teacher_uid = ${uid}) AS totalRevenue,
      (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE teacher_uid = ${uid}) AS averageRating
  `;

  const studentsOverTime = await sql`
    SELECT TO_CHAR(enrolled_at, 'Mon') AS month, COUNT(*) AS count
    FROM enrollments e JOIN course c ON e.course_id = c.id
    WHERE c.teacher_uid = ${uid}
    GROUP BY month ORDER BY MIN(enrolled_at)
  `;

  const revenueByCourse = await sql`
    SELECT c.title AS name, COALESCE(SUM(t.amount),0) AS value
    FROM transactions t JOIN course c ON t.course_id = c.id
    WHERE t.teacher_uid = ${uid}
    GROUP BY c.title
  `;

  const [completion] = await sql`
    SELECT ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / GREATEST(COUNT(*),1), 0) AS rate
    FROM progress p JOIN course c ON p.course_id = c.id
    WHERE c.teacher_uid = ${uid}
  `;

  return NextResponse.json({
    totalStudents: stats?.totalStudents || 0,
    totalcourse: stats?.totalcourse || 0,
    totalRevenue: stats?.totalRevenue || 0,
    averageRating: stats?.averageRating || 0,
    studentsOverTime: studentsOverTime || [],
    revenueByCourse: revenueByCourse || [],
    completionRate: completion?.rate || 0,
  });
});
