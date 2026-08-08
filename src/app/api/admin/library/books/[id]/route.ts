import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // حذف الصفحات المرتبطة أولاً ثم الكتاب
    await sql`DELETE FROM library_pages WHERE book_id = ${params.id}`;
    await sql`DELETE FROM library_books WHERE id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const author = formData.get("author") as string;
    const description = formData.get("description") as string;
    const coverFile = formData.get("cover") as File | null;

    if (title) await sql`UPDATE library_books SET title = ${title} WHERE id = ${params.id}`;
    if (author) await sql`UPDATE library_books SET author = ${author} WHERE id = ${params.id}`;
    if (description) await sql`UPDATE library_books SET description = ${description} WHERE id = ${params.id}`;
    if (coverFile) {
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      const driveUrl = await uploadFileToGoogleDrive(buffer, coverFile.name, coverFile.type || "image/png");
      const cdnUrl = driveUrlToCdnUrl(driveUrl);
      await sql`UPDATE library_books SET cover_url = ${cdnUrl} WHERE id = ${params.id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}