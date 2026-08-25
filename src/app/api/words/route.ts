// src/app/api/words/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const letter = searchParams.get("letter")?.trim() || null;
  const query = searchParams.get("q")?.trim() || null;

  try {
    const sql = neon(process.env.DATABASE_URL!);

    let entries;

    if (letter && query) {
      entries = await sql`
        SELECT id, entry_number, root, word, word_type, meanings, part, page
        FROM dictionary_entries
        WHERE word LIKE ${letter + '%'} AND word LIKE ${'%' + query + '%'}
        ORDER BY word ASC
        LIMIT 1000
      `;
    } else if (letter) {
      entries = await sql`
        SELECT id, entry_number, root, word, word_type, meanings, part, page
        FROM dictionary_entries
        WHERE word LIKE ${letter + '%'}
        ORDER BY word ASC
        LIMIT 1000
      `;
    } else if (query) {
      entries = await sql`
        SELECT id, entry_number, root, word, word_type, meanings, part, page
        FROM dictionary_entries
        WHERE word LIKE ${'%' + query + '%'} OR root LIKE ${'%' + query + '%'}
        ORDER BY word ASC
        LIMIT 1000
      `;
    } else {
      entries = await sql`
        SELECT id, entry_number, root, word, word_type, meanings, part, page
        FROM dictionary_entries
        ORDER BY word ASC
        LIMIT 1000
      `;
    }

    // تحويل meanings من JSONB string إلى array
    const result = entries.map((entry: any) => ({
      ...entry,
      meanings: typeof entry.meanings === 'string' ? JSON.parse(entry.meanings) : entry.meanings,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching dictionary entries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dictionary entries" },
      { status: 500 }
    );
  }
}