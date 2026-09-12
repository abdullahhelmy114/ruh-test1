// src/app/api/library/annotations/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAuth, requireLibraryAccess } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: annotations are keyed by the verified caller's uid (ownership
// unchanged). POST additionally requires library access, matching the reader
// that produces them. page_number is validated as an integer.

// POST: حفظ رسم جديد أو تحديثه
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);
  await requireLibraryAccess(user);

  try {
    const { book_id, page_number, data } = await req.json();
    const page = Number(page_number);

    if (!book_id || !Number.isInteger(page) || page < 1 || !data) {
      return NextResponse.json(
        { error: "Missing required fields: book_id, page_number, data" },
        { status: 400 }
      );
    }

    // التحقق من أن الكتاب موجود
    const [book] = await sql`SELECT id FROM library_books WHERE id = ${book_id}`;
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // إدراج أو تحديث الرسم (يوجد رسم واحد فقط لكل مستخدم لكل صفحة)
    await sql`
      INSERT INTO page_annotations (user_uid, book_id, page_number, data)
      VALUES (${user.uid}, ${book_id}, ${page}, ${data})
      ON CONFLICT (user_uid, book_id, page_number)
      DO UPDATE SET data = ${data}, updated_at = now()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving annotation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// GET: استرجاع الرسم للمستخدم الحالي
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("book_id");
  const pageNumber = Number(searchParams.get("page_number"));

  if (!bookId || !Number.isInteger(pageNumber)) {
    return NextResponse.json(
      { error: "Missing query params: book_id, page_number" },
      { status: 400 }
    );
  }

  try {
    const [annotation] = await sql`
      SELECT data FROM page_annotations
      WHERE user_uid = ${user.uid}
        AND book_id = ${bookId}
        AND page_number = ${pageNumber}
      LIMIT 1
    `;

    return NextResponse.json({
      annotation: annotation || null,
    });
  } catch (error) {
    console.error("Error fetching annotation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
