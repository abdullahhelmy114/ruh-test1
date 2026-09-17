import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

// One page, only when it lies inside the caller's reading access.
export const GET = withApi<{ bookId: string; pageNumber: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { bookId, pageNumber } = await ctx.params;
  return NextResponse.json({ data: await libraryService.getPage(user, bookId, pageNumber) }, { headers: PRIVATE_NO_STORE });
});
