// src/app/api/library/access/route.ts
import { NextResponse } from "next/server";
import { getSession, getLibraryAccess } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: same rules and response shape as before, now sourced from the
// shared getLibraryAccess helper so the reader routes enforce exactly the
// same entitlement server-side. Anonymous callers still get a 200 with
// hasAccess:false (the UI relies on `reason`).
export const GET = withApi(async (req) => {
  const user = await getSession(req);
  if (!user) {
    return NextResponse.json({ hasAccess: false, reason: "login" });
  }

  const access = await getLibraryAccess(user);
  if (access.hasAccess) {
    return NextResponse.json({ hasAccess: true, isAdmin: access.isAdmin, role: access.role });
  }

  return NextResponse.json({ hasAccess: false, reason: "no_subscription" });
});
