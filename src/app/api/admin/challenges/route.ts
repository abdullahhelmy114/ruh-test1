import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

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

const challengeSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(200),
  description: z.string().min(10, 'الوصف قصير جداً').max(3000),
  gender: z.enum(['male', 'female']),  // ✅ إزالة required_error
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  badgeId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

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
}