import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const gender = user.gender;

  try {
    const challenges = await sql`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.gender,
        c.start_date AS "startDate",
        c.end_date AS "endDate",
        c.badge_id AS "badgeId",
        b.name AS "badgeName",
        c.created_by AS "createdBy",
        c.created_at AS "createdAt",
        (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id)::int AS "participantsCount",
        EXISTS (
          SELECT 1 FROM challenge_participants 
          WHERE challenge_id = c.id AND user_id = ${user.uid}
        ) AS "isJoined",
        CASE 
          WHEN c.end_date < CURRENT_DATE THEN 'ended'
          ELSE 'active'
        END AS "status"
      FROM challenges c
      LEFT JOIN badges b ON c.badge_id = b.id
      WHERE c.gender = ${gender}
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}