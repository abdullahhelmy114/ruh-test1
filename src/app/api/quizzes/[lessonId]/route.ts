export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const quizzes = await sql`SELECT * FROM quizzes WHERE lesson_id = ${lessonId}`;
  return NextResponse.json({ quizzes });
}