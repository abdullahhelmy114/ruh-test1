import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const result = await sql`
      SELECT id, title, description, price, course_ids, created_at
      FROM bundles
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ bundles: result || [] });
  } catch (error) {
    console.error('Bundles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}