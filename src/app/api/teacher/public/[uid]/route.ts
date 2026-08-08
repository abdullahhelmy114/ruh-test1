export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: teacherUid } = await params;

  if (!teacherUid) {
    return NextResponse.json({ error: 'Missing teacher uid' }, { status: 400 });
  }

  try {
    // بيانات المعلم الأساسية
    const [teacher] = await sql`
      SELECT full_name, email, nationality, residence, native_language,
             other_languages, age, gender, bio, avatar_url
      FROM profiles
      WHERE firebase_uid = ${teacherUid} AND role = 'teacher'
    `;

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // كورسات المعلم المنشورة
    const courses = await sql`
      SELECT id, title, level, price, description, image_url
      FROM courses
      WHERE teacher_uid = ${teacherUid} AND status = 'published'
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ teacher, courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}