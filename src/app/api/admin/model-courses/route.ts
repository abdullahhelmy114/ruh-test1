import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getAdminAuth } from '@/lib/firebase/admin';

// دالة مساعدة للتحقق من الأدمن باستخدام جدول profiles
async function verifyAdmin(request: Request): Promise<boolean> {
  // محاولة قراءة التوكن من الكوكيز أو الهيدر
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionCookie = cookieHeader
    .split(';')
    .find(c => c.trim().startsWith('__session='))
    ?.split('=')[1];

  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.replace('Bearer ', '');
  const token = sessionCookie || bearerToken;

  if (!token) return false;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const [user] = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}`;
    return user?.role === 'admin';
  } catch {
    return false;
  }
}

// GET /api/admin/model-courses – جلب جميع النماذج
export async function GET(req: Request) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const courses = await sql`
      SELECT id, title, description, level, price, category, scenario, created_at
      FROM model_courses
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Get model courses error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/model-courses – إنشاء نموذج جديد
export async function POST(req: Request) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const { title, description, level, price, category, scenario } = await req.json();

    if (!title || !level || price === undefined) {
      return NextResponse.json(
        { error: 'البيانات ناقصة (العنوان، المستوى، السعر مطلوبة)' },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO model_courses (title, description, level, price, category, scenario)
      VALUES (${title}, ${description || null}, ${level}, ${price}, ${category || null}, ${scenario || null})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Create model course error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}