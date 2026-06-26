import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET() {
  try {
    const books = await sql`
      SELECT id, title, author, description, cover_url, created_at
      FROM library_books
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ books });
  } catch (error) {
    console.error("Library books fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}