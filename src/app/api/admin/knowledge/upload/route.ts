import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import PDFParser from "pdf2json"; // @ts-ignore

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    // 1. قراءة الملف بسرعة
    const buffer = Buffer.from(await file.arrayBuffer());
    const fullText: string = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, true);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(decodeURIComponent(pdfParser.getRawTextContent()).replace(/\r\n/g, " ").replace(/\n/g, " "));
      });
      pdfParser.parseBuffer(buffer);
    });

    if (!fullText.trim()) return NextResponse.json({ error: "Empty PDF" }, { status: 400 });

    // 2. تقطيعه وإعادته للمتصفح فوراً (لن يأخذ أكثر من ثانيتين)
    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];
    const validChunks = chunks.filter(c => c.trim().length >= 50);

    return NextResponse.json({ success: true, chunks: validChunks });

  } catch (error: any) {
    return NextResponse.json({ error: "فشل قراءة الملف" }, { status: 500 });
  }
}