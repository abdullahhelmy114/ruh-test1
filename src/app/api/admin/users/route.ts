export const runtime = 'nodejs'; // أفضل من edge لتوافق sql

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 1 reference migration: this listing exposed every profile's email and
// role with no authentication. It now requires an admin session.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const users = await sql`
    SELECT firebase_uid, email, full_name, role, status, created_at
    FROM profiles
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ users });
});
