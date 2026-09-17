import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

// Preparation status of each assigned teacher. Private notes are never included.
export const GET = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { sessionId } = await ctx.params;
  return NextResponse.json({ data: await lessonSheetService.listPreparationStatuses(user, sessionId) }, { headers: PRIVATE_NO_STORE });
});
