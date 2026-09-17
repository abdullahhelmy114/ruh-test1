import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

// A book for its reader: only the pages the caller may read, and the whole-book file only with full access.
export const GET = withApi<{ bookId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { bookId } = await ctx.params;
  return NextResponse.json({ data: await libraryService.getBook(user, bookId) }, { headers: PRIVATE_NO_STORE });
});
