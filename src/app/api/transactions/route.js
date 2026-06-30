import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { data: transactions, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50); // ดึงล่าสุด 50 รายการ

    if (txErr) throw txErr;

    const formattedTransactions = transactions.map(t => ({
      ...t,
      _id: t.id,
      user: t.user_id,
      amount: Number(t.amount),
      createdAt: t.created_at
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติการทำรายการ' }, { status: 500 });
  }
}

