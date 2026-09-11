import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(async (req) => {
  const session = await requireAdmin(req);

  const { title, category, level, price, scenario } = await req.json();

  try {
    await sql`
      INSERT INTO model_course (admin_id, title, category, level, price, scenario)
      VALUES (${session.uid}, ${title}, ${category}, ${level}, ${price}, ${JSON.stringify(scenario)})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
});