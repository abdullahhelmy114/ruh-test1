import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readJsonObject } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

// The caller's own reading position in a book they may read.
export const GET = withApi<{ bookId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { bookId } = await ctx.params;
  return NextResponse.json({ data: await libraryService.getReadingProgress(user, bookId) }, { headers: PRIVATE_NO_STORE });
});

export const PUT = withApi<{ bookId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { bookId } = await ctx.params;
  const body = await readJsonObject(req);
  return NextResponse.json({ data: await libraryService.saveReadingProgress(user, bookId, { lastPage: body.lastPage }) }, { headers: PRIVATE_NO_STORE });
});
