import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { governanceService } from "@/lib/academy/server";

// Opens an approval request for a subject (and optionally a specific version).
export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const gate = await governanceService.openGate(user, {
    type: body.type,
    subjectKind: body.subjectKind,
    subjectId: body.subjectId,
    subjectVersionId: body.subjectVersionId,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: gate }, { status: 201, headers: PRIVATE_NO_STORE });
});
