// src/app/api/library/access/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ hasAccess: false, reason: "login" });
  }

  // الأدمن دائمًا لديه صلاحية كاملة
  if (session.role === "admin") {
    return NextResponse.json({ hasAccess: true, isAdmin: true, role: "admin" });
  }

  // البحث عن سجل وصول ساري (اشتراك أو صلاحية خاصة)
  const [access] = await sql`
    SELECT id, expires_at, role
    FROM library_access
    WHERE user_uid = ${session.uid}
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;

  if (access) {
    // إذا كان السجل يحتوي على دور محدد (مثل teacher, organization) نرسله،
    // وإلا نعتبره طالبًا عاديًا (student)
    const role = access.role || "student";
    return NextResponse.json({
      hasAccess: true,
      isAdmin: false,
      role,          // ← ستستخدم في BookReaderPage
    });
  }

  // لا يوجد وصول
  return NextResponse.json({
    hasAccess: false,
    reason: "no_subscription",
  });
}