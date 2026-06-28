import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const [user] = await sql`SELECT * FROM profiles WHERE firebase_uid = ${params.uid}`;
    if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}