// src/app/api/admin/library/books/convert/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { createCanvas } from "canvas";
import sharp from "sharp";

// تعيين worker (يمكن استخدام CDN أو local)
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { bookId } = await req.json();
  const [book] = await sql`SELECT id, pdf_url FROM library_books WHERE id = ${bookId}`;
  if (!book || !book.pdf_url) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  try {
    // تحميل PDF
    const pdfResponse = await fetch(book.pdf_url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    const totalPages = pdf.numPages;
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // دقة عالية
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx as any, viewport }).promise;

      const imageBuffer = canvas.toBuffer("image/png");
      // تحويل إلى WebP لضغط الحجم
      const webpBuffer = await sharp(imageBuffer).webp({ quality: 80 }).toBuffer();

      // رفع إلى Google Drive
      const driveUrl = await uploadFileToGoogleDrive(webpBuffer, `page-${i}.webp`, "image/webp");
      const imageUrl = driveUrlToCdnUrl(driveUrl);

      pages.push({ book_id: bookId, page_number: i, image_url: imageUrl });
    }

    // حفظ في قاعدة البيانات
    for (const p of pages) {
      await sql`
        INSERT INTO library_pages (book_id, page_number, image_url)
        VALUES (${p.book_id}, ${p.page_number}, ${p.image_url})
        ON CONFLICT (book_id, page_number) DO UPDATE SET image_url = ${p.image_url}
      `;
    }
    await sql`UPDATE library_books SET pages_count = ${totalPages} WHERE id = ${bookId}`;

    return NextResponse.json({ success: true, pages_count: totalPages });
  } catch (error) {
    console.error("PDF conversion error:", error);
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}