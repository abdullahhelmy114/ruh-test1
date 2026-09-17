import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { lessonScriptService } from "@/lib/academy/server";

const ACTIONS = ["create_draft"] as const;

// Canonical lesson script of a lesson (administrative authoring).
export const GET = withApi<{ lessonId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { lessonId } = await ctx.params;
  return NextResponse.json({ data: await lessonScriptService.getScript(user, lessonId) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi<{ lessonId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { lessonId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const created = await lessonScriptService.createDraft(user, lessonId, {
    basedOnVersionId: body.basedOnVersionId,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: created }, { status: 201, headers: PRIVATE_NO_STORE });
});
