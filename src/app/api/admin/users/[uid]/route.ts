import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.1: full profile row for any uid was readable without
// authentication. Admin session required; `uid` in the path is the TARGET
// user, never the caller. Next 16: params is a Promise and must be awaited.
// SELECT * is retained deliberately (REVIEW_REQUIRED): the admin user-profile
// page reads ~17 columns and the live column list is not documented in-repo.
export const GET = withApi<{ uid: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const { uid } = await ctx.params;

  const [user] = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(user);
});
