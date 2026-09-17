// app/api/admin/generated-content/question/route.ts
// حذف سؤال مولّد

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const DELETE = withApi(async (request) => {
  await requireAdmin(request);

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM generated_questions WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
});