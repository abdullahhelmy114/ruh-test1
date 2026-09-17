import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';


export const GET = withApi(async (req) => {
  const user = await requireCommunityMember(req);

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
          WHERE challenge_id = c.id AND user_uid = ${user.uid}
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
});