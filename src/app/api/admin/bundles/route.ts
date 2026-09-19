import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Retired. Bundle administration read and wrote a `bundles` table that is not
// part of the academy schema. Bundles are not part of the academy model: places
// are sold per class group through Whop offers, managed with courses and class
// groups in the academy administration (/academy/manage). Administrators calling
// this route are told where the work moved; nobody else learns it exists.
const moved = () =>
  NextResponse.json(
    { error: "Bundles are not part of the academy. Courses, class groups and their offers are managed in the academy administration.", moved: "/academy/manage" },
    { status: 410 }
  );

export const GET = withApi(async (req) => {
  await requireAdmin(req);
  return moved();
});

export const POST = withApi(async (req) => {
  await requireAdmin(req);
  return moved();
});
