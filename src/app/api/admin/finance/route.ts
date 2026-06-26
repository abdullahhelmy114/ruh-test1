export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const transactions = await sql`
      SELECT id, user_name, item_name, amount, type, created_at FROM transactions ORDER BY created_at DESC LIMIT 10
    `;
    const payouts = await sql`
      SELECT teacher_id, teacher_name, students_count, commission_rate, pending_amount FROM payouts WHERE status='pending'
    `;
    return NextResponse.json({ transactions, payouts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}