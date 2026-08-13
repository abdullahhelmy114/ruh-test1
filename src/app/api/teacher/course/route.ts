import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const course = await sql`
      SELECT lc.id, lc.title, lc.level, lc.price, lc.status
      FROM live_course lc
      JOIN profiles p ON lc.teacher_uid = p.firebase_uid
      WHERE p.firebase_uid = ${session.uid}
      ORDER BY lc.created_at DESC
    `;
    return NextResponse.json({ course });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}