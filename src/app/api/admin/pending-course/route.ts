import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: unpublished teacher submissions were readable without
// authentication. Admin session required. Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const course = await sql`
    SELECT c.*, p.full_name AS teacher_name
    FROM course c
    JOIN profiles p ON c.teacher_uid = p.firebase_uid
    WHERE c.status = 'pending'
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json({ course });
});
