import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ hasAccess: false, reason: "login" });
  }

  // الأدمن دائمًا لديه صلاحية
  if (session.role === "admin") {
    return NextResponse.json({ hasAccess: true, isAdmin: true });
  }

  // تحقق من وجود وصول في library_access (حقيقي أو وهمي)
  const [access] = await sql`
    SELECT id, expires_at FROM library_access
    WHERE user_id = ${session.uid}
    AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;

  if (access) {
    return NextResponse.json({ hasAccess: true, isAdmin: false });
  }

  // لا يوجد وصول
  return NextResponse.json({ hasAccess: false, reason: "no_subscription" });
}