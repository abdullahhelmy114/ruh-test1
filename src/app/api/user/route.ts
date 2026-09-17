export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession, HttpError, requireAuth, requireSelfOrAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { planProfileUpdate, profileUpdateQuery } from '@/lib/profile/self-profile';

// GET: الملف الشخصي للمستخدم المسجّل دخوله.
// Phase 2.2: returns the verified caller's own profile by default. An explicit
// ?uid= is honoured only for the caller themself or an admin
// (requireSelfOrAdmin → 403 otherwise). SELECT * retained (REVIEW_REQUIRED:
// the profile pages read many columns and the list is not documented in-repo).
export const GET = withApi(async (req) => {
  const requested = new URL(req.url).searchParams.get('uid');
  const user = requested ? await requireSelfOrAdmin(req, requested) : await requireAuth(req);
  const uid = requested ?? user.uid;

  const [profile] = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;
  if (!profile) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile });
});

// PATCH: the signed-in account changes its own profile. What each role may
// change, and how values are validated, is in lib/profile/self-profile.ts; the
// role and status come from the stored account, never from the request. The
// write matches only this account while it still has that role (and, for a
// teacher, the active status), so a concurrent change becomes a conflict.
export const PATCH = withApi(async (req) => {
  const user = await requireAuth(req);
  const role = user.accountRole ?? (user.role === 'applicant' ? 'teacher' : user.role);
  const plan = planProfileUpdate({ role, status: user.accountStatus }, await req.json().catch(() => null));
  const query = profileUpdateQuery(user.uid, plan);
  const rows = await sql.query(query.text, [...query.values]);
  if (rows.length === 0) throw new HttpError(409, 'Your account changed while you were editing. Reload and try again.');
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
});

// POST: إنشاء/تحديث الملف الشخصي للمستخدم المسجّل دخوله فقط.
// Phase 0 containment: identity comes from the verified session, never from the
// body, and `role` can no longer be set by the client. Existing rows keep their
// role; new rows default to 'student'.
// Phase 3 batch 4: `email_verified` is no longer part of this upsert at all.
// New rows take the column default (false) and existing rows keep their
// value; only the OTP verifiers set it. Only the explicitly listed fields
// (email, fullName, referred_by) are taken from the request.
export async function POST(request: Request) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';

    if (!email) {
      return NextResponse.json({ skipped: true });
    }

    const referredBy = typeof body.referred_by === 'string' ? body.referred_by : null;
    const fullName = typeof body.fullName === 'string' ? body.fullName : '';

    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, referred_by)
      VALUES (${session.uid}, ${email}, ${fullName}, 'student', ${referredBy})
      ON CONFLICT (firebase_uid) DO UPDATE SET
        email = ${email},
        full_name = ${fullName},
        referred_by = COALESCE(profiles.referred_by, ${referredBy})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile upsert failed:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
