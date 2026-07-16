export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherUid = searchParams.get('teacherUid');
  const filter = searchParams.get('filter') || 'never-enrolled'; // never-enrolled | one-course | certificate-level | all
  const level = searchParams.get('level') || 'B1';
  const exportEmails = searchParams.get('export') === 'true';

  if (!teacherUid) {
    return NextResponse.json({ error: 'Missing teacherUid' }, { status: 400 });
  }

  try {
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
              JOIN courses c ON e.course_id = c.id
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
            JOIN courses c ON e.course_id = c.id
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
              SELECT id FROM courses WHERE teacher_uid = ${teacherUid}
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
              JOIN courses c ON e.course_id = c.id
              WHERE c.teacher_uid = ${teacherUid}
            )
        `;
    }

    const students = await query;

    if (exportEmails) {
      const emails = students.map((s: any) => s.email).join(', ');
      return new NextResponse(emails, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="student-emails.txt"',
        },
      });
    }

    return NextResponse.json({ students });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}