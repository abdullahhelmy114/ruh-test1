import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Links a published item to a course, lesson or assessment.
export const POST = withApi<{ itemId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { itemId } = await ctx.params;
  const body = await readJsonObject(req);
  const link = await productionService.addLink(user, itemId, {
    targetKind: body.targetKind,
    targetId: body.targetId,
    purpose: body.purpose,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: link }, { status: 201, headers: PRIVATE_NO_STORE });
});
