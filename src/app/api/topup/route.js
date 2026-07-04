import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { notifyTopup } from '@/lib/adminNotifications';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { amount, method, refCode } = await request.json();

    if (method === 'giftcode') {
      if (!refCode || typeof refCode !== 'string') {
        return NextResponse.json({ error: 'กรุณากรอกรหัสเติมเงิน' }, { status: 400 });
      }

      // 1. ค้นหารหัสเติมเงินในตาราง topup_codes
      const { data: codeRecord, error: codeErr } = await supabaseAdmin
        .from('topup_codes')
        .select('*')
        .eq('code', refCode.trim().toUpperCase())
        .eq('is_used', false)
        .maybeSingle();

      if (codeErr) throw codeErr;
      if (!codeRecord) {
        return NextResponse.json({ error: 'รหัสเติมเงินไม่ถูกต้อง หรือถูกใช้งานไปแล้ว' }, { status: 400 });
      }

      // 2. ดึงข้อมูลผู้ใช้เพื่อคำนวณ balance ใหม่
      const { data: user, error: userErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userErr) throw userErr;
      if (!user) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
      }

      const topupAmount = Number(codeRecord.amount);
      const nextBalance = Number(user.balance) + topupAmount;

      // 3. ปรับปรุงสถานะรหัสเติมเงินเป็นใช้งานแล้ว (พร้อมระบุตัวผู้ใช้และวันเวลาที่ใช้)
      const { error: updateCodeErr } = await supabaseAdmin
        .from('topup_codes')
        .update({
          is_used: true,
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', codeRecord.id);

      if (updateCodeErr) throw updateCodeErr;

      // 4. เพิ่มเงินเข้าบัญชีผู้ใช้
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ balance: nextBalance })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      // 5. บันทึกประวัติการทำรายการ
      const { error: txErr } = await supabaseAdmin
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type: 'topup',
            amount: topupAmount,
            description: `แลกโค้ดรางวัล Gacha: ${refCode.trim().toUpperCase()}`,
            status: 'completed',
          }
        ]);

      if (txErr) throw txErr;

      // แจ้งเตือนแอดมิน
      await notifyTopup({
        username: user.username || user.email,
        amount: topupAmount,
        method: 'Gacha Gift Code',
      });

      return NextResponse.json({
        message: 'เติมเงินผ่านโค้ดรางวัลสำเร็จแล้ว!',
        newBalance: nextBalance,
      });
    }

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

    await notifyTopup({
      username: user.username || user.email,
      amount,
      method: method || 'PromptPay',
    });

    return NextResponse.json({
      message: 'เติมเงินสำเร็จแล้ว!',
      newBalance: nextBalance,
    });
  } catch (error) {
    console.error('Topup error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลการเติมเงิน' }, { status: 500 });
  }
}

