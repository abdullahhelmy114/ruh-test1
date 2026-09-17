export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { HttpError, requireAuth, requireSelfOrAdmin } from '@/lib/auth';
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
// Retired. The session requires an existing profile, so this "upsert" could
// never create one; all it could do was overwrite the caller's stored email
// with any address and set who referred the account (self-referral or a
// forged referrer). Nothing in the application called it. Accounts are created
// by the signup routes; profile fields change through PATCH above; referral
// attribution happens once, at student signup (lib/referral.ts).
export const POST = withApi(async (req) => {
  await requireAuth(req);
  return NextResponse.json({ error: 'This endpoint has been removed.' }, { status: 410 });
});
