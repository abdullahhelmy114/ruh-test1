export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { title, body } = await request.json();
    if (!title || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // استعلام المستخدمين المفعلين من جدول profiles
    const users = await sql`SELECT firebase_uid as uid FROM profiles WHERE status = 'active'`;
    const message = `${title}: ${body}`;
    
    for (const user of users) {
      await sql`
        INSERT INTO notifications (user_uid, message, link)
        VALUES (${user.uid}, ${message}, '/dashboard')
      `;
    }
    
    return NextResponse.json({ success: true, count: users.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}