import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["change_state"] as const;

export const PATCH = withApi<{ libraryId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { libraryId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const library = await productionService.changeLibraryState(user, libraryId, {
    to: body.to,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: library }, { headers: PRIVATE_NO_STORE });
});
