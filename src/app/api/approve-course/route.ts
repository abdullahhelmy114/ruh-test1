import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.3a: previously unauthenticated — anyone could set any course's
// status. Admin session required. Status values are passed through unchanged
// (the repository defines no allowlist). Edge runtime removed for
// firebase-admin compatibility.
export const PUT = withApi(async (req) => {
  await requireAdmin(req);

  const { courseId, status } = await req.json();
  if (!courseId || !status) {
    return NextResponse.json({ error: 'Missing courseId or status' }, { status: 400 });
  }

  const result = await sql`
    UPDATE course SET status = ${status}
    WHERE id = ${courseId}
    RETURNING id, title, status
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  return NextResponse.json({ course: result[0] });
});
