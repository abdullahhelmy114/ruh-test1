import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Launch reinforcement: this stub had no authentication and queried a
// hard-coded teacher id. It now serves only the signed-in teacher's own
// earnings, with the columns the earnings page shows (no buyer details).
// The Whop-based earnings model replaces this in the payments phase.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);
  const earnings = await sql`
    SELECT te.id, te.amount, te.status, te.created_at, pc.course_id, c.title AS course_title
    FROM teacher_earnings te
    JOIN purchase_course pc ON te.purchase_course_id = pc.id
    JOIN course c ON pc.course_id = c.id
    WHERE te.teacher_uid = ${user.uid}
    ORDER BY te.id DESC
  `;
  return NextResponse.json(earnings);
});
