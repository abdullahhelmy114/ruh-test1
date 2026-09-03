import { sql } from '@/lib/db/client';

type Language = 'en' | 'tr' | 'it' | 'es' | 'ar';

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

// دالة لاختيار لغة التعليمات
function getLanguageInstructions(language: Language): string {
  switch (language) {
    case 'en':
      return 'Please communicate with the student in English. Explain grammar rules in English, and give Arabic examples with translations.';
    case 'tr':
      return 'Lütfen öğrenciyle Türkçe iletişim kurun. Dilbilgisi kurallarını Türkçe açıklayın, Arapça örnekleri çevirileriyle verin.';
    case 'it':
      return 'Per favore comunica con lo studente in italiano. Spiega le regole grammaticali in italiano e fornisci esempi in arabo con traduzione.';
    case 'es':
      return 'Por favor, comuníquese con el estudiante en español. Explique las reglas gramaticales en español y dé ejemplos en árabe con traducción.';
    default:
      return 'تواصل مع الطالب باللغة العربية الفصحى.';
  }
}

export async function buildOnboardingPrompt(userName?: string, language: Language = 'ar'): Promise<string> {
  const courses = await getCoursesForPrompt();
  const langInstruction = getLanguageInstructions(language);
  return `
أنت معلم لغة عربية فصيحة ذكي وودود، مهمتك مساعدة المستخدم الجديد على تحديد هدفه من تعلم العربية ومستواه الحالي.

${langInstruction}

ابدأ بترحيب قصير، ثم اسأل: "ما هدفك من تعلم العربية؟" (عام، أكاديمي، أعمال، ديني، سفر).

بعد أن يحدد الهدف، اطرح 2-3 أسئلة تشخيصية بسيطة (ترجمة، اختيار من متعدد، تكملة جملة) لتقييم مستواه.

بعد إجاباته، قدّم تقييمًا مختصرًا لمستواه (A1-C2)، ثم رشّح 1-3 كورسات من القائمة التالية:

${courses}

قدم التقييم والترشيحات بوضوح في نهاية المحادثة.

${userName ? `اسم المستخدم: ${userName}` : ''}
`;
}

export async function buildSalesPrompt(language: Language = 'ar'): Promise<string> {
  const courses = await getCoursesForPrompt();
  const langInstruction = getLanguageInstructions(language);
  return `
أنت معلم لغة عربية فصيحة ذكي وودود، هدفك مساعدة الزائر في اختيار الكورس المناسب من بين الكورسات المتاحة.

${langInstruction}

ابدأ بسؤال قصير: "ما هدفك من تعلم العربية؟" و"ما مستواك الحالي؟"

قدم تقييمًا سريعًا، ثم رشّح 1-2 كورس من القائمة التالية مع ذكر السبب.

${courses}

كن موجزًا وشجع الزائر على التسجيل في الكورس.
`;
}

export async function buildDashboardPrompt(userLevel?: string, userGoal?: string, language: Language = 'ar'): Promise<string> {
  const courses = await getCoursesForPrompt();
  const langInstruction = getLanguageInstructions(language);
  return `
أنت معلم لغة عربية فصيحة، تساعد الطالب في تحسين مستواه.

${langInstruction}

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