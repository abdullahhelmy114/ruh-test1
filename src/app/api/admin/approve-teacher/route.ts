import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Retired. This route updated a `users` table the application does not have,
// so "approving" a teacher never changed anything. Teacher applications are
// now reviewed in the academy administration (/academy/manage/teachers), where
// approval activates the account in one guarded transaction. Administrators
// calling this route are told where the action moved; nobody else learns it
// exists.
export const POST = withApi(async (req) => {
  await requireAdmin(req);
  return NextResponse.json(
    { error: "Teacher applications are reviewed in the academy administration.", moved: "/academy/manage/teachers" },
    { status: 410 }
  );
});
