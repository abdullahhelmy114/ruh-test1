import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";

// A short-lived private link to an application document (kind: cv | intro_video).
// POST because opening a document is recorded in the audit trail.
export const POST = withApi<{ applicationId: string; kind: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { applicationId, kind } = await ctx.params;
  const data = await teacherService.openDocument(user, applicationId, kind, { correlationId: readCorrelationId(req) });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
