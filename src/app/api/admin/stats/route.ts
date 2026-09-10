import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: total platform revenue and internal queue sizes were readable
// without authentication. Admin session required. Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM profiles WHERE role='student') AS total_students,
      (SELECT COUNT(*) FROM profiles WHERE role='teacher') AS total_teachers,
      (SELECT COUNT(*) FROM course WHERE status='published') AS active_course,
      (SELECT COALESCE(SUM(amount),0) FROM transactions) AS total_revenue
  `;
  const [pending] = await sql`
    SELECT
      (SELECT COUNT(*) FROM teacher_applications WHERE status='pending') AS teacher_applications,
      (SELECT COUNT(*) FROM course WHERE status='pending') AS course_pending,
      (SELECT COUNT(*) FROM payouts WHERE status='pending') AS payouts_pending,
      0 AS reported_content
  `;
  return NextResponse.json({ stats, pending });
});
