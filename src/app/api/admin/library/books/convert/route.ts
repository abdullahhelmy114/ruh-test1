// src/app/api/admin/library/books/convert/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";
import sharp from "sharp";

export const runtime = "nodejs";

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
    // نسخة مؤقتة: إنشاء صفحة واحدة فارغة بدلاً من تحويل PDF فعلي
    const totalPages = 1;
    const pages = [];

    const imageBuffer = await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .webp({ quality: 80 })
      .toBuffer();

    const driveUrl = await uploadFileToGoogleDrive(
      imageBuffer,
      `page-1.webp`,
      "image/webp"
    );
    const imageUrl = driveUrlToCdnUrl(driveUrl);
    pages.push({ book_id: bookId, page_number: 1, image_url: imageUrl });

    for (const p of pages) {
      await sql`
        INSERT INTO library_pages (book_id, page_number, image_url)
        VALUES (${p.book_id}, ${p.page_number}, ${p.image_url})
        ON CONFLICT (book_id, page_number)
        DO UPDATE SET image_url = ${p.image_url}
      `;
    }
    await sql`UPDATE library_books SET pages_count = ${totalPages} WHERE id = ${bookId}`;

    return NextResponse.json({ success: true, pages_count: totalPages });
  } catch (error) {
    console.error("PDF conversion error:", error);
    return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
  }
}