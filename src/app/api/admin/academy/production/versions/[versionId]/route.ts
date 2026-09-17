import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["save", "submit", "withdraw", "request_changes", "approve", "reject", "unapprove", "archive", "publish"] as const;

// Full content with answer keys and provenance: administrators only.
export const GET = withApi<{ versionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { versionId } = await ctx.params;
  return NextResponse.json({ data: await productionService.getVersion(user, versionId) }, { headers: PRIVATE_NO_STORE });
});

// Publishing requires rights cleared and an approved publication approval gate for this version.
export const PATCH = withApi<{ versionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { versionId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  switch (action) {
    case "save":
      return NextResponse.json(
        { data: await productionService.saveVersion(user, versionId, { content: body.content, provenance: body.provenance, expectedRevision: body.expectedRevision, correlationId }) },
        { headers: PRIVATE_NO_STORE },
      );
    case "publish":
      return NextResponse.json({ data: await productionService.publish(user, versionId, { expectedRevision: body.expectedRevision, correlationId }) }, { headers: PRIVATE_NO_STORE });
    default:
      return NextResponse.json(
        { data: await productionService.review(user, versionId, { action, reason: body.reason, expectedRevision: body.expectedRevision, correlationId }) },
        { headers: PRIVATE_NO_STORE },
      );
  }
});
