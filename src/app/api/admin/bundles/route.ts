import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

// ==========================================
// 1. دالة GET لجلب الباقات (تم إعدادها مسبقاً)
// ==========================================
export async function GET(req: NextRequest) {
  try {
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bundles = await sql.query(`SELECT * FROM bundles ORDER BY created_at DESC`);
    return NextResponse.json(bundles || []);
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ==========================================
// 2. دالة POST لإنشاء باقة جديدة (التي تسببت بالخطأ 405)
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // استقبال البيانات من الواجهة
    const body = await req.json();
    console.log("بيانات الباقة المستلمة:", body);

    // سحب البيانات الأساسية (بافتراض أن الواجهة ترسل title و price)
    // ملاحظة: إذا كانت أسماء الحقول مختلفة، سيتم الاعتماد على قاعدة البيانات لرمي خطأ واضح
    const title = body.title || body.name || "باقة جديدة";
    const price = body.price || 0;
    const status = body.status || "active";

    // إدخال الباقة في قاعدة البيانات (يرجى التأكد من أسماء الأعمدة في جدول bundles لديك)
    const newBundle = await sql.query(
      `INSERT INTO bundles (title, price, status) VALUES ($1, $2, $3) RETURNING *`,
      [title, price, status]
    );

    return NextResponse.json({ message: "تم إنشاء الباقة بنجاح", bundle: newBundle[0] }, { status: 201 });

  } catch (error) {
    console.error("Error creating bundle:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}