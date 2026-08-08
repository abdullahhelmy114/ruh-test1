// app/api/admin/library/books/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const author = (formData.get("author") as string) || "";
    const description = (formData.get("description") as string) || "";
    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    if (!title) {
      return NextResponse.json({ error: "Book title is required" }, { status: 400 });
    }

    let coverUrl = "";
    let pdfUrl = "";

    if (coverFile && typeof coverFile.arrayBuffer === "function") {
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      const driveUrl = await uploadFileToGoogleDrive(buffer, coverFile.name, coverFile.type || "image/png");
      coverUrl = driveUrlToCdnUrl(driveUrl);
    }

    if (pdfFile && typeof pdfFile.arrayBuffer === "function") {
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      const driveUrl = await uploadFileToGoogleDrive(buffer, pdfFile.name, pdfFile.type || "application/pdf");
      pdfUrl = driveUrlToCdnUrl(driveUrl);
    }
    // إدراج الكتاب في قاعدة البيانات
    const [book] = await sql`
      INSERT INTO library_books (title, author, description, cover_url, pdf_url)
      VALUES (${title}, ${author}, ${description}, ${coverUrl}, ${pdfUrl})
      RETURNING id
    `;

    return NextResponse.json({ success: true, bookId: book.id });
  } catch (error) {
    console.error("Add book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}