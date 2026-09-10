import { NextResponse } from 'next/server';

// Phase 0 containment: this endpoint enrolled any uid in any course without
// auth or payment. Disabled; enrollment is created only by the Whop webhook
// (paid) or the authenticated free-enrollment path.
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed.' },
    { status: 410 }
  );
}
