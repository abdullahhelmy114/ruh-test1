import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { catalogService } from "@/lib/academy/server";

const ACTIONS = ["update", "change_status", "delete", "restore"] as const;

export const GET = withApi<{ programId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { programId } = await ctx.params;
  return NextResponse.json({ data: await catalogService.getProgram(user, programId) }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ programId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { programId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  const common = { expectedRevision: body.expectedRevision, correlationId };
  switch (action) {
    case "update":
      return NextResponse.json({
        data: await catalogService.updateProgram(user, programId, { ...common, title: body.title, description: body.description }),
      }, { headers: PRIVATE_NO_STORE });
    case "change_status":
      return NextResponse.json({
        data: await catalogService.changeProgramStatus(user, programId, { ...common, to: body.to, reason: body.reason }),
      }, { headers: PRIVATE_NO_STORE });
    case "delete":
      return NextResponse.json({ data: await catalogService.deleteProgram(user, programId, { ...common, reason: body.reason }) }, { headers: PRIVATE_NO_STORE });
    case "restore":
      return NextResponse.json({ data: await catalogService.restoreProgram(user, programId, { ...common, reason: body.reason }) }, { headers: PRIVATE_NO_STORE });
  }
});
