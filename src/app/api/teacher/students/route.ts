import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the teacher whose students are listed is the verified caller
// (user.uid); the client no longer supplies teacherUid. The `never-enrolled`
// filter lists every student on the platform and is admin-only per the
// approved decision. Query bodies are unchanged. Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);
  const teacherUid = user.uid;

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'all'; // all | never-enrolled (admin) | one-course | certificate-level

  if (filter === 'never-enrolled' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query;

  switch (filter) {
    case 'never-enrolled':
      // طلاب لم يشتركوا أبداً في كورسات هذا المعلم
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender, p.created_at
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
      // طلاب اشتركوا في كورس واحد فقط وأكملوه ولم يشتركوا في غيره
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender, p.created_at
        FROM profiles p
        WHERE p.role = 'student'
          AND p.firebase_uid IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid}
            GROUP BY e.user_uid
            HAVING COUNT(DISTINCT e.course_id) = 1
          )
          AND p.firebase_uid NOT IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid}
            GROUP BY e.user_uid
            HAVING COUNT(DISTINCT e.course_id) > 1
          )
      `;
      break;

    case 'certificate-level': {
      const level = searchParams.get('level') || 'B1';
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender, p.created_at
        FROM profiles p
        WHERE p.role = 'student'
          AND p.firebase_uid IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            JOIN certificates cert ON cert.user_uid = e.user_uid AND cert.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid} AND cert.level = ${level}
          )
      `;
      break;
    }

    default:
      // all – كل الطلاب المسجلين عند هذا المعلم
      query = sql`
        SELECT p.firebase_uid AS uid, p.full_name, p.email, p.nationality, p.residence,
               p.native_language, p.other_languages, p.age, p.gender, p.created_at
        FROM profiles p
        WHERE p.role = 'student'
          AND p.firebase_uid IN (
            SELECT e.user_uid FROM enrollments e
            JOIN course c ON e.course_id = c.id
            WHERE c.teacher_uid = ${teacherUid}
          )
      `;
  }

  const students = await query;
  return NextResponse.json({ students });
});
