import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth"; // نفترض وجود دالة لاستخراج الجلسة

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { title, category, level, price, scenario } = await req.json();

  try {
    await sql`
      INSERT INTO model_courses (admin_id, title, category, level, price, scenario)
      VALUES (${session.uid}, ${title}, ${category}, ${level}, ${price}, ${JSON.stringify(scenario)})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}