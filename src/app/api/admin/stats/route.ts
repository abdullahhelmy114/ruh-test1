export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM profiles WHERE role='student') AS total_students,
        (SELECT COUNT(*) FROM profiles WHERE role='teacher') AS total_teachers,
        (SELECT COUNT(*) FROM courses WHERE status='published') AS active_courses,
        (SELECT COALESCE(SUM(amount),0) FROM transactions) AS total_revenue
    `;
    const [pending] = await sql`
      SELECT
        (SELECT COUNT(*) FROM teacher_applications WHERE status='pending') AS teacher_applications,
        (SELECT COUNT(*) FROM courses WHERE status='pending') AS courses_pending,
        (SELECT COUNT(*) FROM payouts WHERE status='pending') AS payouts_pending,
        0 AS reported_content
    `;
    return NextResponse.json({ stats, pending });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}