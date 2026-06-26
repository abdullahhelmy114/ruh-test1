export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const courses = await sql`
      SELECT c.*, p.full_name AS teacher_name
      FROM courses c
      JOIN profiles p ON c.teacher_uid = p.firebase_uid
      WHERE c.status = 'pending'
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}