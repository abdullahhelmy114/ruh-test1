import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { curriculumService } from "@/lib/academy/server";

const ACTIONS = ["save_outline", "submit", "withdraw", "request_changes", "approve", "reject", "unapprove", "archive", "publish"] as const;

export const GET = withApi<{ versionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { versionId } = await ctx.params;
  return NextResponse.json({ data: await curriculumService.getVersion(user, versionId) }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ versionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { versionId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  switch (action) {
    case "save_outline":
      return NextResponse.json({
        data: await curriculumService.saveOutline(user, versionId, {
          outline: body.outline,
          expectedRevision: body.expectedRevision,
          correlationId,
        }),
      }, { headers: PRIVATE_NO_STORE });
    case "publish":
      return NextResponse.json({
        data: await curriculumService.publish(user, versionId, { expectedRevision: body.expectedRevision, correlationId }),
      }, { headers: PRIVATE_NO_STORE });
    default:
      return NextResponse.json({
        data: await curriculumService.review(user, versionId, {
          action,
          reason: body.reason,
          expectedRevision: body.expectedRevision,
          correlationId,
        }),
      }, { headers: PRIVATE_NO_STORE });
  }
});
