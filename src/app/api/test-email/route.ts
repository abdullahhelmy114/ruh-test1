import { NextResponse } from "next/server";

// Phase 0 containment: unauthenticated test endpoint that sent email on every
// GET. Disabled. This file is untracked and should not be committed.
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
