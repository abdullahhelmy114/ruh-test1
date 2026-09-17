import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

const ACTIONS = ["remove"] as const;

export const PATCH = withApi<{ resourceId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { resourceId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const resource = await libraryService.removeCourseResource(user, resourceId, {
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: resource }, { headers: PRIVATE_NO_STORE });
});
