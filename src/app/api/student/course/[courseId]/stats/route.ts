import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    points: 0,
    streak: 0,
    badges: [],
  });
}