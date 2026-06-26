export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { uid, bio, country, interests } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    // الاستعلام صحيح تماماً لأننا نحدث الجدول الأساسي profiles بناءً على firebase_uid
    await sql`
      UPDATE profiles
      SET bio = ${bio || ''}, 
          country = ${country || ''}, 
          interests = ${interests || ''}, 
          profile_completed = true
      WHERE firebase_uid = ${uid}
    `;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}