import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { verifyIdToken } from '@/lib/firebase/server';

export async function GET(req: Request) {
  const user = await verifyIdToken(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const bundles = await sql`
      SELECT id, title, description, price, course_ids, featured, created_at
      FROM bundles
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ bundles });
  } catch (error) {
    console.error('Get bundles error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await verifyIdToken(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { title, description, price, model_course_ids, featured } = await req.json();

    if (!title || !model_course_ids || !Array.isArray(model_course_ids) || model_course_ids.length !== 3) {
      return NextResponse.json({ error: 'Title and exactly 3 courses are required' }, { status: 400 });
    }

    await sql`
      INSERT INTO bundles (title, description, price, course_ids, featured)
      VALUES (${title}, ${description || null}, ${price}, ${JSON.stringify(model_course_ids)}, ${featured || false})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Create bundle error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}