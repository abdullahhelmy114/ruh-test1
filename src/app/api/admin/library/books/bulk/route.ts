// app/api/admin/library/books/bulk/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      if (!file || typeof file.arrayBuffer !== "function") continue;

      // استخراج اسم الكتاب من اسم الملف (بدون امتداد)
      const fileName = file.name.replace(/\.[^/.]+$/, "");

      const buffer = Buffer.from(await file.arrayBuffer());
      const driveUrl = await uploadFileToGoogleDrive(buffer, file.name, file.type || "application/pdf");
      const pdfUrl = await driveUrlToCdnUrl(driveUrl);

      const [book] = await sql`
        INSERT INTO library_books (title, author, description, cover_url, pdf_url)
        VALUES (${fileName}, '', '', NULL, ${pdfUrl})
        RETURNING id, title
      `;
      results.push(book);
    }

    return NextResponse.json({ success: true, books: results });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}