import { NextRequest, NextResponse } from 'next/server';
import { buildOnboardingPrompt, buildSalesPrompt, buildDashboardPrompt } from '@/lib/tutorPrompts';
import { sql } from '@/lib/db/client';

type Language = 'en' | 'tr' | 'it' | 'es' | 'ar';

// دالة استخراج التقييم بصيغة JSON من رد المعلم
async function extractAssessment(replyText: string, apiKey: string): Promise<any | null> {
  const extractionPrompt = `
استخرج من النص التالي معلومات تقييم الطالب:
- المستوى (level) من A1 إلى C2
- الهدف (goal) من القيم التالية: general, academic, business, religious, travel
- ملخص تقييم مختصر (notes)
- قائمة بمعرفات الكورسات المقترحة (recommended_courses) من النص

النص: "${replyText}"

أعد النتيجة بصيغة JSON فقط بدون أي نص إضافي.
مثال: {"level":"A2","goal":"general","notes":"مستوى متوسط","recommended_courses":["arabic-a2-general"]}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 300 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
    }
    return null;
  } catch (error) {
    console.error('فشل استخراج التقييم:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history = [],
      context = 'dashboard',
      userLevel,
      userGoal,
      userName,
      userId,
      language = 'ar', // ✅ لغة جديدة
    } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'الرسالة فارغة أو غير صالحة' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح API غير مضبوط' }, { status: 500 });
    }

    let systemPrompt = '';
    if (context === 'onboarding') {
      systemPrompt = await buildOnboardingPrompt(userName, language as Language);
    } else if (context === 'sales') {
      systemPrompt = await buildSalesPrompt(language as Language);
    } else {
      systemPrompt = await buildDashboardPrompt(userLevel, userGoal, language as Language);
    }

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'حسنًا، لنبدأ! كيف يمكنني مساعدتك؟' }] },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      throw new Error(data.error?.message || 'فشل الاتصال بـ Gemini');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذرًا، لم أستطع الرد.';

    let assessment = null;
    if (context === 'onboarding' && userId) {
      assessment = await extractAssessment(reply, apiKey);
      if (assessment) {
        await sql`
          INSERT INTO user_assessment (user_id, user_goal, user_level, assessment_notes, recommended_course_ids)
          VALUES (
            ${userId},
            ${assessment.goal || null},
            ${assessment.level || null},
            ${assessment.notes || reply},
            ${assessment.recommended_courses || []}
          )
        `;
      }
    }

    return NextResponse.json({ reply, assessment });
  } catch (error) {
    console.error('Error in /api/tutor:', error);
    return NextResponse.json({ error: 'حدث خطأ في المعالجة' }, { status: 500 });
  }
}