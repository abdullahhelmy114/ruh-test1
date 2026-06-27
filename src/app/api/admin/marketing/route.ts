export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'never-enrolled';
  const exportEmails = searchParams.get('export') === 'true';

  try {
    let students: any[] = [];

    switch (filter) {
      case 'never-enrolled':
        students = await sql`SELECT full_name, email FROM profiles WHERE role='student' AND firebase_uid NOT IN (SELECT user_uid FROM enrollments)`;
        break;
      case 'one-course':
        students = await sql`
          SELECT p.full_name, p.email FROM profiles p
          JOIN (SELECT user_uid FROM enrollments GROUP BY 1 HAVING COUNT(course_id)=1) sub ON p.firebase_uid=sub.user_uid
        `;
        break;
      case 'all':
        students = await sql`SELECT full_name, email FROM profiles WHERE role='student'`;
        break;
    }

    if (exportEmails) {
      const emails = students.map((s: any) => s.email).join(', ');
      return new NextResponse(emails, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="admin-student-emails.txt"',
        },
      });
    }

    return NextResponse.json({ students });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}