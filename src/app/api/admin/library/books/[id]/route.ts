// src/app/api/admin/library/books/[id]/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";
import { uploadFileToGoogleDrive, driveUrlToCdnUrl } from "@/lib/google-drive";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // حذف الصفحات والتراكبات والتصنيفات المرتبطة أولاً
    await sql`DELETE FROM page_overlays WHERE book_id = ${params.id}`;
    await sql`DELETE FROM book_categories WHERE book_id = ${params.id}`;
    await sql`DELETE FROM library_pages WHERE book_id = ${params.id}`;
    await sql`DELETE FROM library_books WHERE id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const categoriesRaw = formData.get("categories") as string | null;

    // تحديث بيانات الكتاب الأساسية
    if (title) await sql`UPDATE library_books SET title = ${title} WHERE id = ${params.id}`;
    if (author) await sql`UPDATE library_books SET author = ${author} WHERE id = ${params.id}`;
    if (description) await sql`UPDATE library_books SET description = ${description} WHERE id = ${params.id}`;

    if (coverFile) {
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      const driveUrl = await uploadFileToGoogleDrive(
        buffer,
        coverFile.name,
        coverFile.type || "image/png"
      );
      const cdnUrl = driveUrlToCdnUrl(driveUrl);
      await sql`UPDATE library_books SET cover_url = ${cdnUrl} WHERE id = ${params.id}`;
    }

    // تحديث التصنيفات
    if (categoriesRaw) {
      try {
        const categoryIds: string[] = JSON.parse(categoriesRaw);

        // حذف كل التصنيفات المرتبطة حالياً
        await sql`DELETE FROM book_categories WHERE book_id = ${params.id}`;

        // إدراج التصنيفات الجديدة
        if (Array.isArray(categoryIds) && categoryIds.length > 0) {
          for (const categoryId of categoryIds) {
            await sql`
              INSERT INTO book_categories (book_id, category_id)
              VALUES (${params.id}, ${categoryId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      } catch (parseError) {
        console.warn("Failed to parse categories JSON:", parseError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}