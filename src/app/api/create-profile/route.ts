export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

// Phase 0 containment: this route previously created a profile for any uid with
// any role, unauthenticated. It now requires a verified session, uses the
// session uid, and always creates the row as 'student'. Slated for removal in
// Phase 2 (superseded by POST /api/user).
export async function POST(request: Request) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName : '';
    if (!email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, email_verified)
      VALUES (${session.uid}, ${email}, ${fullName}, 'student', false)
      ON CONFLICT (firebase_uid) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('create-profile failed:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
