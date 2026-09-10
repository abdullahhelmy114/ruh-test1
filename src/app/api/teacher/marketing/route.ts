import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the teacher whose audience is listed is the verified caller
// (user.uid); the client no longer supplies teacherUid. Two boundaries per the
// approved decision: the `never-enrolled` filter (which lists every student on
// the platform) and the plain-text email export are admin-only. Teachers keep
// the filters scoped to their own enrollments. Query bodies are unchanged.
// Edge runtime removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);
  const teacherUid = user.uid;
  const isAdmin = user.role === 'admin';

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'all'; // never-enrolled (admin) | one-course | certificate-level | all
  const level = searchParams.get('level') || 'B1';
  const exportEmails = searchParams.get('export') === 'true';

  if (filter === 'never-enrolled' && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (exportEmails && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query;

  switch (filter) {
    case 'never-enrolled':
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender
        FROM profiles p
        WHERE p.role = 'student'
          AND p.firebase_uid NOT IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid}
          )
      `;
      break;

    case 'one-course':
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender
        FROM profiles p
        JOIN (
          SELECT e.user_uid
          FROM enrollments e
          JOIN course c ON e.course_id = c.id
          WHERE c.teacher_uid = ${teacherUid}
          GROUP BY e.user_uid
          HAVING COUNT(DISTINCT e.course_id) = 1
        ) sub ON p.firebase_uid = sub.user_uid
      `;
      break;

    case 'certificate-level':
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender
        FROM profiles p
        JOIN certificates cert ON p.firebase_uid = cert.user_uid
        WHERE cert.level = ${level}
          AND cert.course_id IN (
            SELECT id FROM course WHERE teacher_uid = ${teacherUid}
          )
      `;
      break;

    default:
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender
        FROM profiles p
        WHERE p.role = 'student'
          AND p.firebase_uid IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid}
          )
      `;
  }

  const students = (await query) as { email: string | null }[];

  if (exportEmails) {
    const emails = students.map((s) => s.email).filter(Boolean).join(', ');
    return new NextResponse(emails, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="student-emails.txt"',
      },
    });
  }

  return NextResponse.json({ students });
});
