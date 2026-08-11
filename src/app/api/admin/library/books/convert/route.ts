// src/app/api/admin/library/books/convert/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const execPromise = promisify(exec);

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

  const tempDir = path.join("/tmp", bookId);
  try {
    // جلب PDF من الرابط
    const pdfResponse = await fetch(book.pdf_url);
    if (!pdfResponse.ok) throw new Error("Failed to fetch PDF");
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfPath = path.join(tempDir, "book.pdf");

    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(pdfPath, pdfBuffer);

    // تحويل PDF إلى صور PNG باستخدام pdftoppm (أفضل للعربية)
    // -r 300: دقة عالية للصور الممسوحة
    // -png: إخراج PNG
    // -scale-to-x 800 -scale-to-y 1100: تغيير الحجم
    await execPromise(
      `pdftoppm -r 300 -png -scale-to-x 800 -scale-to-y 1100 "${pdfPath}" "${tempDir}/page"`
    );

    // قراءة جميع الصور الناتجة (page-1.png, page-2.png, ...)
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith(".png")).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

    const pages = [];

    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(tempDir, files[i]);
      const pageBuffer = fs.readFileSync(filePath);
      
      // ضغط إلى WebP لتوفير المساحة
      const webpBuffer = await sharp(pageBuffer)
        .webp({ quality: 80 })
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
      fs.unlinkSync(filePath);
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
      await sql`UPDATE library_books SET pages_count = ${pages.length} WHERE id = ${bookId}`;
    }

    // تنظيف المجلد المؤقت
    fs.rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({ success: true, pages_count: pages.length });
  } catch (error) {
    console.error("Conversion failed:", error);
    // تنظيف في حال الخطأ
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}