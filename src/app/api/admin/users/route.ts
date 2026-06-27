export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const users = await sql`
      SELECT uid, email, first_name, last_name, role, status, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    // إضافة حقل full_name ليسهل العرض
    const formatted = users.map((u: any) => ({
      ...u,
      full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
    }));
    return NextResponse.json({ users: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}