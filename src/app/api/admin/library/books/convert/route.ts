// app/api/admin/library/books/convert/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";
import sharp from "sharp";
import { fromBuffer } from "pdf2pic";

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { bookId } = await req.json();

  // جلب رابط PDF من قاعدة البيانات
  const [book] = await sql`
    SELECT id, pdf_url FROM library_books WHERE id = ${bookId}
  `;
  if (!book || !book.pdf_url) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  try {
    // جلب PDF من الرابط
    const pdfResponse = await fetch(book.pdf_url);
    if (!pdfResponse.ok) throw new Error("Failed to fetch PDF");
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // تحويل PDF إلى صور PNG مؤقتة
    const options = {
      density: 150, // جودة عالية
      saveFilename: bookId,
      savePath: "/tmp",
      format: "png",
      width: 800,
      height: 1100,
    };

    const converter = fromBuffer(pdfBuffer, options);
    const result = await converter.bulk(-1); // كل الصفحات

    if (!result || !Array.isArray(result)) {
      throw new Error("Conversion failed");
    }

    const fs = require("fs");
    const pages = [];

    for (let i = 0; i < result.length; i++) {
      const page = result[i];
      if (!page || !page.path) continue;

      // قراءة الصورة المحولة وضغطها إلى WebP
      const pageBuffer = fs.readFileSync(page.path);
      const webpBuffer = await sharp(pageBuffer)
        .webp({ quality: 80 }) // ضغط جيد مع جودة عالية
        .toBuffer();

      // رفع الصورة إلى Google Drive
      const driveUrl = await uploadFileToGoogleDrive(
        webpBuffer,
        `page-${i + 1}.webp`,
        "image/webp"
      );
      const imageUrl = driveUrlToCdnUrl(driveUrl);

      pages.push({
        book_id: bookId,
        page_number: i + 1,
        image_url: imageUrl,
      });

      // حذف الملف المؤقت
      fs.unlinkSync(page.path);
    }

    // تخزين الصفحات في قاعدة البيانات
    if (pages.length > 0) {
      for (const page of pages) {
        await sql`
          INSERT INTO library_pages (book_id, page_number, image_url)
          VALUES (${page.book_id}, ${page.page_number}, ${page.image_url})
          ON CONFLICT (book_id, page_number) DO UPDATE SET image_url = ${page.image_url}
        `;
      }

      // تحديث عدد صفحات الكتاب
      await sql`
        UPDATE library_books SET pages_count = ${pages.length} WHERE id = ${bookId}
      `;
    }

    return NextResponse.json({ success: true, pages_count: pages.length });
  } catch (error) {
    console.error("Conversion failed:", error);
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}