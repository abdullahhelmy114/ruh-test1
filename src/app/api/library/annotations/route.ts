// src/app/api/library/annotations/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

// POST: حفظ رسم جديد أو تحديثه
export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // الأدمن لا يحتاج لحفظ رسومات (لكن يمكن السماح به إن أردت)
  // if (session.role === "admin") {
  //   return NextResponse.json({ error: "Admins don't save annotations" }, { status: 400 });
  // }

  try {
    const { book_id, page_number, data } = await req.json();

    if (!book_id || !page_number || !data) {
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
      VALUES (${session.uid}, ${book_id}, ${page_number}, ${data})
      ON CONFLICT (user_uid, book_id, page_number)
      DO UPDATE SET data = ${data}, updated_at = now()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving annotation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: استرجاع الرسم للمستخدم الحالي
export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("book_id");
  const pageNumber = searchParams.get("page_number");

  if (!bookId || !pageNumber) {
    return NextResponse.json(
      { error: "Missing query params: book_id, page_number" },
      { status: 400 }
    );
  }

  try {
    const [annotation] = await sql`
      SELECT data FROM page_annotations
      WHERE user_uid = ${session.uid}
        AND book_id = ${bookId}
        AND page_number = ${parseInt(pageNumber)}
      LIMIT 1
    `;

    return NextResponse.json({
      annotation: annotation || null,
    });
  } catch (error) {
    console.error("Error fetching annotation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}