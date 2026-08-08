import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { category_id, title, description, intro_video_url, price, launch_date, course_duration, lesson_duration, instructor_name, theme, is_published } = await req.json();
  await sql`
    UPDATE courses SET category_id=${category_id}, title=${title}, description=${description}, intro_video_url=${intro_video_url},
    price=${price}, launch_date=${launch_date}, course_duration=${course_duration}, lesson_duration=${lesson_duration},
    instructor_name=${instructor_name}, theme=${theme}, is_published=${is_published}
    WHERE id=${params.id}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  await sql`DELETE FROM courses WHERE id=${params.id}`;
  return NextResponse.json({ success: true });
}