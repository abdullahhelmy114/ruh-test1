import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readStringParam } from "@/lib/academy/http";
import { adminService } from "@/lib/academy/server";

// Every academy setting resolved for a target (?programId&courseId): inherited, effective, override.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await adminService.policyMap(user, { programId: readStringParam(req, "programId"), courseId: readStringParam(req, "courseId") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
