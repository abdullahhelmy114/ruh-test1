// src/app/api/certification/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // مؤقتًا نعيد بيانات فارغة حتى لا يظهر خطأ 404
  // يمكن لاحقًا ربطها بجدول الشهادات
  return NextResponse.json({ certification: null });
}