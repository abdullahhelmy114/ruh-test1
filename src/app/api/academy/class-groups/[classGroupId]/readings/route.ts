import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

// The course reading list for a class group's participants (no book files).
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await libraryService.classGroupReadings(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
