// src/app/api/admin/curriculum/outline/route.ts
import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import { groqJSONCompletion } from "@/lib/groq-client";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const level = formData.get("level")?.toString() || "A1";
    const instructions = formData.get("instructions")?.toString() || "";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
    }

    // استخراج النص من كل ملف
    const allTexts: string[] = [];
    for (const file of files) {
      if (file.type !== "application/pdf") continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractTextFromPdfBuffer(buffer);
      allTexts.push(`--- بداية ملف: ${file.name} ---\n${text}\n--- نهاية ملف: ${file.name} ---`);
    }

    const combinedText = allTexts.join("\n\n");
    if (combinedText.trim().length === 0) {
      return NextResponse.json({ error: "No text could be extracted from PDFs" }, { status: 400 });
    }

    // تقليم النص إلى حد أقصى (مثلاً 40000 حرف) لتجنب تجاوز الحدود
    const maxChars = 40000;
    const truncatedText = combinedText.length > maxChars 
      ? combinedText.slice(0, maxChars) + "\n...(تم الاقتصاص)" 
      : combinedText;

    const systemPrompt = `أنت خبير مناهج تعليمية متخصص في تعليم اللغة العربية والقرآن الكريم للناطقين بغيرها. مهمتك هي تحليل النصوص المقدمة وإنشاء خطة دروس مفصلة بصيغة JSON.`;

    const userPrompt = `
النصوص المقدمة:
"""
${truncatedText}
"""

المستوى المستهدف: ${level}

التعليمات الإضافية:
${instructions || "لا توجد تعليمات إضافية."}

المطلوب:
أنشئ قائمة دروس متسلسلة تغطي المحتوى بشكل شامل. يجب أن يكون كل درس عنوانه واضحًا ووصفه موجزًا (جملة أو جملتين). حدد عدد الدروس بناءً على التعليمات أو حسب حجم المحتوى (لا تقل عن 5 ولا تزيد عن 50 ما لم تذكر التعليمات غير ذلك).

أعد الناتج بصيغة JSON فقط بدون أي نص إضافي، بالشكل التالي:
{
  "lessons": [
    {
      "title": "عنوان الدرس",
      "description": "وصف مختصر"
    },
    ...
  ]
}
`;

    const parsed = await groqJSONCompletion<{ lessons: { title: string; description: string }[] }>(
      userPrompt,
      systemPrompt,
      {
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
        temperature: 0.7,
        max_tokens: 8000,
      }
    );

    if (!parsed || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
      throw new Error("Invalid response format from AI");
    }

    return NextResponse.json({ lessons: parsed.lessons });
  } catch (error: any) {
    console.error("Error generating outline:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate outline" },
      { status: 500 }
    );
  }
}