import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.3a: the previous guard read a `session` cookie the app never sets,
// called an uninitialized Firebase Admin instance, and checked a custom claim
// that is never issued, so it always returned 403. Replaced by the central
// requireAdmin guard; validation and insert logic are unchanged.

const challengeSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(200),
  description: z.string().min(10, 'الوصف قصير جداً').max(3000),
  gender: z.enum(['male', 'female']),  // ✅ إزالة required_error
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  badgeId: z.string().uuid().optional().nullable(),
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);

  const body = await req.json();
  const validation = challengeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { title, description, gender, startDate, endDate, badgeId } = validation.data;

  try {
    const result = await sql`
      INSERT INTO challenges (title, description, gender, start_date, end_date, badge_id, created_by)
      VALUES (${title}, ${description}, ${gender}, ${startDate}, ${endDate}, ${badgeId || null}, ${user.uid})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});