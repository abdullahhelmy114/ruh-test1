import { NextResponse } from "next/server";

// Retired: legacy course bundles read a `bundles` table that is not part of the
// academy schema (production logged "relation bundles does not exist" on every
// homepage visit). Bundles are not part of the academy model: places are sold
// per class group through Whop offers. Nothing in the site calls this anymore.
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
