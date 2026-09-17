import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readBooleanParam } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";

// Teacher accounts with status, open class group assignments and latest
// application. ?activeOnly=true lists only teachers who may be assigned.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await teacherService.listTeachers(user, { activeOnly: readBooleanParam(req, "activeOnly") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
