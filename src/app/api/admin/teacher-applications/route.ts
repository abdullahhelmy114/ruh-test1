import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Retired. This list read pending teacher profiles for a review screen whose
// approve and reject buttons never took effect. Applications, with their
// history and private documents, are listed by
// GET /api/admin/academy/teacher-applications (screen: /academy/manage/teachers).
export const GET = withApi(async (req) => {
  await requireAdmin(req);
  return NextResponse.json(
    { error: "Teacher applications are reviewed in the academy administration.", moved: "/academy/manage/teachers" },
    { status: 410 }
  );
});
