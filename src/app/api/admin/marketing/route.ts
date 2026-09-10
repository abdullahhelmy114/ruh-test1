import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: bulk student name/email listing and plain-text email export were
// reachable without authentication. Admin session required. Edge runtime
// removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'never-enrolled';
  const exportEmails = searchParams.get('export') === 'true';

  type StudentRow = { full_name: string | null; email: string | null };
  let students: StudentRow[] = [];

  switch (filter) {
    case 'never-enrolled':
      students = (await sql`SELECT full_name, email FROM profiles WHERE role='student' AND firebase_uid NOT IN (SELECT user_uid FROM enrollments)`) as StudentRow[];
      break;
    case 'one-course':
      students = (await sql`
        SELECT p.full_name, p.email FROM profiles p
        JOIN (SELECT user_uid FROM enrollments GROUP BY 1 HAVING COUNT(course_id)=1) sub ON p.firebase_uid=sub.user_uid
      `) as StudentRow[];
      break;
    case 'all':
      students = (await sql`SELECT full_name, email FROM profiles WHERE role='student'`) as StudentRow[];
      break;
  }

  if (exportEmails) {
    const emails = students.map((s) => s.email).filter(Boolean).join(', ');
    return new NextResponse(emails, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="admin-student-emails.txt"',
      },
    });
  }

  return NextResponse.json({ students });
});
