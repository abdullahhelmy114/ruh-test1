import { NextResponse } from "next/server";

// Retired: this legacy course list read a `live_course` table that is not part of
// the academy schema (production logged "relation live_course does not exist" on
// every homepage visit). The public course list is the academy catalog:
// /api/public/academy/catalog, shown at /academy and on the homepage.
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
