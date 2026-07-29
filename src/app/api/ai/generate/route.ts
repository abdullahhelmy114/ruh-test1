import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من الصلاحية (أدمن فقط)
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // 2. استلام البيانات من CurriculumModal
    const { bookTitle, level, instructions } = await req.json();
    if (!bookTitle || !level) {
      return NextResponse.json(
        { error: "يجب إرسال bookTitle و level" },
        { status: 400 }
      );
    }

    // 3. جلب file_uri من قاعدة البيانات
    const books = await sql`
      SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
    `;
    if (!books || books.length === 0) {
      return NextResponse.json(
        { error: "الكتاب غير موجود في قاعدة المعرفة" },
        { status: 404 }
      );
    }
    const fileUri: string = books[0].file_uri;

    // 4. استخراج النص الكامل من PDF باستخدام Gemini File API
// 4. استخراج النص الكامل من PDF باستخدام Gemini File API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const extractionModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // النموذج الأقدم المتاح والأقل تشددًا
});

const extractionResult = await extractionModel.generateContent([
  {
    fileData: {
      mimeType: "application/pdf",
      fileUri: fileUri,
    },
  },
  {
    // موجه تعليمي لتجنب مشكلة RECITATION
    text: "أنشئ تحليلًا تعليميًا مفصلاً لمحتوى هذا الكتاب. قم بتقسيم المحتوى إلى وحدات ودروس، واشرح المفاهيم اللغوية والدينية الواردة بأسلوب تعليمي يناسب معلمي اللغة العربية. أعد الصياغة بأسلوبك، مع الحفاظ على التسلسل الأصلي للموضوعات. لا تنسخ النص حرفيًا بل قدم إعادة صياغة تعليمية للمفاهيم."
  },
]);

const bookText = extractionResult.response.text();
if (!bookText || bookText.length < 100) {
  throw new Error("النص المستخرج قصير جدًا أو فارغ، تأكد من محتوى الكتاب");
}

    // 5. إرسال النص إلى خدمة وكلاء بايثون لتوليد المنهج
    const pythonServiceUrl =
      process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";

    const pythonResponse = await fetch(
      `${pythonServiceUrl}/generate-curriculum`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_text: bookText,
          level: level,
          instructions: instructions || "",
        }),
      }
    );

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(
        errData?.detail || "فشل الاتصال بخدمة توليد المنهج (Python)"
      );
    }

    const curriculumData = await pythonResponse.json();

    // 6. إرجاع المنهج النهائي للواجهة الأمامية (Markdown + عناوين الدروس)
    return NextResponse.json({
      success: true,
      markdown: curriculumData.markdown,
      titles: curriculumData.titles,
    });
  } catch (error: any) {
    console.error("Curriculum Generation Error:", error);
    return NextResponse.json(
      { error: "فشل في توليد المنهج", details: error.message },
      { status: 500 }
    );
  }
}