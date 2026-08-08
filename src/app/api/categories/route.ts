import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  const categories = await sql`SELECT id, name, slug FROM categories ORDER BY name ASC`;
  return NextResponse.json({ categories });
}