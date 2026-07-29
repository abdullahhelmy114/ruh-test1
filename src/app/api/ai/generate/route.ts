import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// إعداد pdfjs ليعمل بدون worker في بيئة Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = "";
(pdfjsLib.GlobalWorkerOptions as any).disableWorker = true;

/**
 * استخراج النص من PDF باستخدام pdfjs (لا يتطلب worker)
 */
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // استقبال FormData من الواجهة (رفع ملف PDF)
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "يرجى رفع ملف PDF مباشرة" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const level = formData.get("level") as string;
    const instructions = (formData.get("instructions") as string) || "";
    const pdfFile = formData.get("pdfFile") as File | null;

    if (!level || !pdfFile) {
      return NextResponse.json(
        { error: "يجب توفير المستوى ورفع ملف PDF" },
        { status: 400 }
      );
    }

    // استخراج النص من الملف مباشرة
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const bookText = await extractTextFromBuffer(buffer);

    if (!bookText || bookText.length < 100) {
      return NextResponse.json(
        { error: "النص المستخرج قصير جداً أو فارغ" },
        { status: 500 }
      );
    }

    // إرسال النص إلى خدمة بايثون (وكلاء OpenRouter)
    const pythonServiceUrl =
      process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";

    const pythonResponse = await fetch(
      `${pythonServiceUrl}/generate-curriculum`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_text: bookText,
          level,
          instructions,
        }),
      }
    );

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(errData?.detail || "فشل الاتصال بخدمة بايثون");
    }

    const curriculumData = await pythonResponse.json();
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