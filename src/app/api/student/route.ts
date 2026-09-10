import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth, requireSelfOrAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: returns the verified caller's own profile by default. An
// explicit ?uid= is honoured only for the caller themself or an admin
// (requireSelfOrAdmin → 403 otherwise). SELECT * retained (REVIEW_REQUIRED:
// column list not documented in-repo). Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const requested = new URL(req.url).searchParams.get('uid');
  const user = requested ? await requireSelfOrAdmin(req, requested) : await requireAuth(req);
  const uid = requested ?? user.uid;

  const rows = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;

  if (rows.length === 0) {
    return NextResponse.json({ profile: null, message: 'Profile not found' });
  }

  return NextResponse.json({ profile: rows[0] });
});
