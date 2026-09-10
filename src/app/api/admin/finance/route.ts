import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: financial records (purchaser names, amounts, teacher payout
// balances) were readable without authentication. Admin session required.
// Edge runtime removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const transactions = await sql`
    SELECT id, user_name, item_name, amount, type, created_at FROM transactions ORDER BY created_at DESC LIMIT 10
  `;
  const payouts = await sql`
    SELECT teacher_uid, teacher_name, students_count, commission_rate, pending_amount FROM payouts WHERE status='pending'
  `;
  return NextResponse.json({ transactions, payouts });
});
