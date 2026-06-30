import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { data: transactions, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select(`
        id,
        user_id,
        type,
        amount,
        description,
        status,
        created_at,
        users:user_id (username, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (txErr) throw txErr;

    const formattedTransactions = transactions.map(t => ({
      _id: t.id,
      id: t.id,
      user: t.users ? { username: t.users.username, email: t.users.email } : null,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      status: t.status,
      createdAt: t.created_at
    }));

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Admin fetch transactions error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติการทำรายการหลังบ้าน' }, { status: 500 });
  }
}

