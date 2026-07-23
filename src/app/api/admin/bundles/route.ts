import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function GET(req: NextRequest) {
  try {
    // 1. التحقق من صلاحيات المشرف
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. جلب الباقات من قاعدة البيانات
    const bundles = await sql.query(`SELECT * FROM bundles ORDER BY created_at DESC`);

    // 3. إرجاع البيانات (إذا كان الجدول فارغاً، bundles سيكون [] وهذا آمن)
    return NextResponse.json(bundles || []);
    
  } catch (error) {
    console.error("Error fetching bundles:", error);
    // القبض على الخطأ ومنع انهيار الخادم
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}