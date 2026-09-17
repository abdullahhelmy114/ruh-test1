import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readStringParam } from "@/lib/academy/http";
import { adminService } from "@/lib/academy/server";

// The audit trail, newest first (?objectKind&objectId&actorUid&action&correlationId&before&limit).
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await adminService.auditTrail(user, {
    objectKind: readStringParam(req, "objectKind"),
    objectId: readStringParam(req, "objectId"),
    actorUid: readStringParam(req, "actorUid"),
    action: readStringParam(req, "action"),
    correlationId: readStringParam(req, "correlationId"),
    before: readStringParam(req, "before"),
    limit: readStringParam(req, "limit"),
  });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
