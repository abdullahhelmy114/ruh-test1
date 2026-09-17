import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readStringParam } from "@/lib/academy/http";
import { attendanceService } from "@/lib/academy/server";

// The signed-in learner's own attendance in one class group (?classGroupId=...).
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  const data = await attendanceService.myAttendance(user, readStringParam(req, "classGroupId"));
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
