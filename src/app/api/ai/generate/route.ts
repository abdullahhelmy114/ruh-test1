import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import Pdf2Json from "pdf2json";

/**
 * استخراج النص من PDF باستخدام pdf2json (يعمل بدون DOM أو worker)
 */
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new Pdf2Json();
    pdfParser.on("pdfParser_dataError", (err) => reject(err));
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        const text = pdfData.Pages.map((page: any) =>
          page.Texts.map((t: any) => decodeURIComponent(t.R[0].T)).join(" ")
        ).join("\n");
        resolve(text);
      } catch (e) {
        reject(new Error("فشل تحليل بيانات PDF"));
      }
    });
    pdfParser.parseBuffer(buffer);
  });
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "يرجى رفع ملف PDF مباشرة" }, { status: 400 });
    }

    const formData = await req.formData();
    const level = formData.get("level") as string;
    const instructions = (formData.get("instructions") as string) || "";
    const pdfFile = formData.get("pdfFile") as File | null;

    if (!level || !pdfFile) {
      return NextResponse.json({ error: "يجب توفير المستوى ورفع ملف PDF" }, { status: 400 });
    }

    // استخراج النص باستخدام pdf2json
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const bookText = await extractTextFromBuffer(buffer);

    if (!bookText || bookText.length < 100) {
      return NextResponse.json({ error: "النص المستخرج قصير جداً أو فارغ" }, { status: 500 });
    }

    // إرسال النص إلى خدمة بايثون
    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";
    const pythonResponse = await fetch(`${pythonServiceUrl}/generate-curriculum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_text: bookText, level, instructions }),
    });

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