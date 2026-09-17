import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readStringParam } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";

// Teacher applications for review: ?state=awaiting (submitted, in review or at
// interview), one state (submitted|in_review|interview|changes_requested|approved|
// rejected|withdrawn), or no state for every application.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await teacherService.listApplications(user, { state: readStringParam(req, "state") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
