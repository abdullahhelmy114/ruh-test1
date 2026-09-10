export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: completion is recorded for the verified caller (user.uid); the
// client no longer supplies uid. lessonId remains the target. Enrollment
// verification for the lesson's course is deferred to the paid-content batch.
export const POST = withApi(async (req) => {
  const user = await requireStudent(req);

  const { lessonId } = await req.json();
  if (!lessonId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await sql`
    INSERT INTO lesson_completions (lesson_id, user_uid) VALUES (${lessonId}, ${user.uid})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ success: true });
});
