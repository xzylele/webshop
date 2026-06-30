import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { amount, method, refCode } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    // ทำการจำลองการเพิ่มยอดเงินในฐานข้อมูล
    const nextBalance = Number(user.balance) + Number(amount);
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    // บันทึกรายการธุรกรรม
    const { error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'topup',
          amount: Number(amount),
          description: `เติมเงินผ่าน ${method || 'PromptPay'} อ้างอิง: ${refCode || 'MOCK-' + Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          status: 'completed',
        }
      ]);

    if (txErr) throw txErr;

    return NextResponse.json({
      message: 'เติมเงินสำเร็จแล้ว!',
      newBalance: nextBalance,
    });
  } catch (error) {
    console.error('Topup error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลการเติมเงิน' }, { status: 500 });
  }
}

