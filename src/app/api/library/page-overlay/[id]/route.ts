import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// One page overlay, for the administration library editor (which called
// update and delete endpoints that did not exist). Administrators only.
const TYPES = ["video", "audio", "quiz", "game", "iframe", "link"] as const;

export const PUT = withApi<{ id: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const type = body?.type;
  const position = body?.position;
  const content = body?.content;
  if (typeof type !== "string" || !(TYPES as readonly string[]).includes(type) || !position || typeof position !== "object" || !content || typeof content !== "object") {
    return NextResponse.json({ error: "type, position and content are required" }, { status: 400 });
  }
  const [overlay] = await sql`
    UPDATE page_overlays SET type = ${type}, position = ${JSON.stringify(position)}, content = ${JSON.stringify(content)}
    WHERE id = ${id}
    RETURNING id, book_id, page_number, type, position, content
  `;
  if (!overlay) return NextResponse.json({ error: "Overlay not found" }, { status: 404 });
  return NextResponse.json({ overlay });
});

export const DELETE = withApi<{ id: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const deleted = await sql`DELETE FROM page_overlays WHERE id = ${id} RETURNING id`;
  if (deleted.length === 0) return NextResponse.json({ error: "Overlay not found" }, { status: 404 });
  return NextResponse.json({ success: true });
});
