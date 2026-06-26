export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function PUT(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { status } = await request.json();
    const { courseId } = await context.params;

    if (!courseId || !status) {
      return NextResponse.json({ error: 'Missing courseId or status' }, { status: 400 });
    }
    if (!['published', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const result = await sql`
      UPDATE courses SET status = ${status}
      WHERE id = ${courseId}
      RETURNING id, title, status
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ course: result[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}