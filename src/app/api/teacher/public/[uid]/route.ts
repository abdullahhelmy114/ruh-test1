export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// Phase 3 batch 1 — public teacher profile DTO.
// This is an intentionally public route (the /teachers/[uid] page). It used
// to return the teacher's email, age and gender, and selected columns that
// do not exist in `profiles` (residence, native_language, other_languages,
// avatar_url), so it failed at runtime. It now returns an explicit public
// projection: name, bio, nationality, country of residence and languages.
// Private fields (email, age, gender, contact handles, CV) are never
// returned here. Response keys expected by the page are preserved.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: teacherUid } = await params;
  if (!teacherUid) {
    return NextResponse.json({ error: 'Missing teacher uid' }, { status: 400 });
  }

  try {
    const [teacher] = await sql`
      SELECT full_name, bio, nationality,
             country_of_residence AS residence,
             languages AS native_language
      FROM profiles
      WHERE firebase_uid = ${teacherUid} AND role = 'teacher'
    `;

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const course = await sql`
      SELECT id, title, level, price, description, image_url
      FROM course
      WHERE teacher_uid = ${teacherUid} AND status = 'published'
    `;

    return NextResponse.json({
      teacher: {
        full_name: teacher.full_name,
        bio: teacher.bio,
        nationality: teacher.nationality,
        residence: teacher.residence,
        native_language: teacher.native_language,
        avatar_url: null,
      },
      course,
    });
  } catch (error) {
    console.error('Teacher public profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
