import { sql } from '@/lib/db/client';

/**
 * نشر إنجاز تلقائي في حائط المجتمع
 * @param userId معرّف المستخدم (uid من Firebase)
 * @param gender جنس المستخدم
 * @param content نص الإنجاز (مثلاً: "أكمل أحمد سورة البقرة")
 */
export async function publishAchievement(
  userId: string,
  gender: 'male' | 'female',
  content: string
) {
  try {
    await sql`
      INSERT INTO community_posts (user_id, gender, type, content)
      VALUES (${userId}, ${gender}, 'achievement', ${content})
    `;
  } catch (error) {
    console.error('فشل نشر الإنجاز التلقائي:', error);
    // لا نرمي الخطأ حتى لا نعطل العملية الأساسية (إكمال الكورس مثلاً)
  }
}