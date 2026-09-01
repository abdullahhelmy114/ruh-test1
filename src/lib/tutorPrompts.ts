import { sql } from '@/lib/db/client';

async function getCoursesForPrompt(): Promise<string> {
  const courses = await sql`
    SELECT id, title, description, level, course_duration
    FROM course
    WHERE is_published = true
    ORDER BY created_at ASC
  `;

  if (courses.length === 0) return 'لا توجد كورسات متاحة حاليًا.';

  return courses
    .map(
      (c: any) =>
        `- ${c.id}: ${c.title || 'بدون عنوان'} (المستوى ${c.level || 'غير محدد'}) - ${c.description || ''} - المدة: ${c.course_duration || 'غير محددة'}`
    )
    .join('\n');
}

export async function buildOnboardingPrompt(userName?: string): Promise<string> {
  const courses = await getCoursesForPrompt();
  return `
أنت معلم لغة عربية فصيحة ذكي وودود، مهمتك مساعدة المستخدم الجديد على تحديد هدفه من تعلم العربية ومستواه الحالي.

ابدأ بترحيب قصير، ثم اسأل: "ما هدفك من تعلم العربية؟" (عام، أكاديمي، أعمال، ديني، سفر).

بعد أن يحدد الهدف، اطرح 2-3 أسئلة تشخيصية بسيطة (ترجمة، اختيار من متعدد، تكملة جملة) لتقييم مستواه.

بعد إجاباته، قدّم تقييمًا مختصرًا لمستواه (A1-C2)، ثم رشّح 1-3 كورسات من القائمة التالية:

${courses}

قدم التقييم والترشيحات بوضوح في نهاية المحادثة.

${userName ? `اسم المستخدم: ${userName}` : ''}
`;
}

export async function buildSalesPrompt(): Promise<string> {
  const courses = await getCoursesForPrompt();
  return `
أنت معلم لغة عربية فصيحة ذكي وودود، هدفك مساعدة الزائر في اختيار الكورس المناسب من بين الكورسات المتاحة.

ابدأ بسؤال قصير: "ما هدفك من تعلم العربية؟" و"ما مستواك الحالي؟"

قدم تقييمًا سريعًا، ثم رشّح 1-2 كورس من القائمة التالية مع ذكر السبب.

${courses}

كن موجزًا وشجع الزائر على التسجيل في الكورس.
`;
}

export async function buildDashboardPrompt(userLevel?: string, userGoal?: string): Promise<string> {
  const courses = await getCoursesForPrompt();
  return `
أنت معلم لغة عربية فصيحة، تساعد الطالب في تحسين مستواه.

مستوى الطالب الحالي: ${userLevel || 'غير محدد'}
هدفه: ${userGoal || 'غير محدد'}

مهامك:
- الرد على أسئلة الطالب وتصحيح أخطائه.
- تقديم تمارين قصيرة تتناسب مع مستواه.
- إذا طلب الطالب، اقترح كورسات مناسبة من القائمة التالية:

${courses}

كن مشجعًا وفصيحًا، وركز على نقاط الضعف التي تظهر من محادثتك.
`;
}