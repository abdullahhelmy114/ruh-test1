// app/api/admin/generated-content/game/route.ts
// حذف لعبة مولّدة

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
    await sql`DELETE FROM generated_games WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting game:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete game" },
      { status: 500 }
    );
  }
});