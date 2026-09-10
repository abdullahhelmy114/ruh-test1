import { NextResponse } from "next/server";

// Phase 0 containment: this endpoint granted lifetime library access without
// payment. Disabled; library entitlements will be driven by Whop in Phase 3.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
