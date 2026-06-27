export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { uid, courseId } = await request.json();
    if (!uid || !courseId) return NextResponse.json({ error: 'Missing uid or courseId' }, { status: 400 });

    await sql`INSERT INTO enrollments (user_uid, course_id) VALUES (${uid}, ${courseId}) ON CONFLICT DO NOTHING`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}