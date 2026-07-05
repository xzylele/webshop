import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'กรุณาระบุสินค้าที่ต้องการแลก' }, { status: 400 });
    }

    // 1. ดึงข้อมูล User & Item แบบปลอดภัย
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from('point_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr) throw itemErr;
    if (!item) {
      return NextResponse.json({ error: 'ไม่พบของรางวัลนี้ในระบบ' }, { status: 404 });
    }

    if (!item.is_active) {
      return NextResponse.json({ error: 'ของรางวัลนี้ปิดใช้งานชั่วคราว' }, { status: 400 });
    }

    // 2. ตรวจสอบพอยท์สะสม
    if (user.points < item.point_cost) {
      return NextResponse.json({ error: `แต้มสะสมไม่เพียงพอ (ต้องการ ${item.point_cost} แต้ม แต่คุณมี ${user.points} แต้ม)` }, { status: 400 });
    }

    // 3. ตรวจสอบสต็อก
    if (item.stock === 0) {
      return NextResponse.json({ error: 'ของรางวัลชิ้นนี้หมดแล้ว!' }, { status: 400 });
    }

    let codeAwarded = null;
    let rewardData = item.reward_data || {};

    if (item.reward_type === 'code') {
      const codes = rewardData.codes || [];
      if (codes.length === 0) {
        return NextResponse.json({ error: 'โค้ดรางวัลในคลังหมดชั่วคราว กรุณาติดต่อแอดมิน' }, { status: 400 });
      }
      codeAwarded = codes[0];
    }

    // 4. หักพอยท์ในระบบ
    const nextPoints = user.points - item.point_cost;
    const userUpdatePayload = { points: nextPoints };
    let nextBalance = Number(user.balance);

    // ดำเนินการอัปเดตรางวัลส่งมอบ
    let descriptionText = `แลกของรางวัล: ${item.name} (-${item.point_cost} แต้ม)`;

    if (item.reward_type === 'credit') {
      const amount = Number(rewardData.amount) || 0;
      nextBalance = nextBalance + amount;
      userUpdatePayload.balance = nextBalance;
      descriptionText += ` (ได้รับเครดิต +${amount} บาท)`;
    }

    const { error: userUpdateErr } = await supabaseAdmin
      .from('users')
      .update(userUpdatePayload)
      .eq('id', user.id);

    if (userUpdateErr) throw userUpdateErr;

    // 5. ปรับปรุงสต็อกของรางวัล
    const itemUpdatePayload = {};
    if (item.stock > 0) {
      itemUpdatePayload.stock = item.stock - 1;
    }
    if (item.reward_type === 'code') {
      const remainingCodes = (rewardData.codes || []).slice(1);
      itemUpdatePayload.reward_data = { ...rewardData, codes: remainingCodes };
      // อัปเดตฟิลด์สต็อกเท่ากับจำนวนโค้ดที่เหลือด้วย
      itemUpdatePayload.stock = remainingCodes.length;
    }

    if (Object.keys(itemUpdatePayload).length > 0) {
      const { error: itemUpdateErr } = await supabaseAdmin
        .from('point_items')
        .update(itemUpdatePayload)
        .eq('id', item.id);
      if (itemUpdateErr) throw itemUpdateErr;
    }

    // 6. ส่งมอบของรางวัลประเภท Coupon เข้าตาราง coupons
    if (item.reward_type === 'coupon') {
      const discount = Number(rewardData.discount) || 0;
      const couponCode = `REDEEM-${Math.random().toString(36).substr(2, 6).toUpperCase()}#${user.id}`;
      
      const { error: couponErr } = await supabaseAdmin
        .from('coupons')
        .insert([{
          code: couponCode,
          discount: discount,
          type: 'fixed',
          max_uses_per_user: 1,
          is_active: true,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // ใช้ได้ 30 วัน
        }]);

      if (couponErr) throw couponErr;
      codeAwarded = couponCode.split('#')[0];
    }

    // 7. บันทึกประวัติแต้ม
    const { error: logErr } = await supabaseAdmin
      .from('point_transactions')
      .insert([{
        user_id: user.id,
        type: 'redeem',
        amount: -item.point_cost,
        description: descriptionText + (codeAwarded ? ` | รหัสโค้ด: ${codeAwarded}` : '')
      }]);
    if (logErr) throw logErr;

    // 8. บันทึกธุรกรรมวอลเล็ตกรณีได้เครดิต
    if (item.reward_type === 'credit') {
      const amount = Number(rewardData.amount) || 0;
      await supabaseAdmin
        .from('transactions')
        .insert([{
          user_id: user.id,
          type: 'adjust',
          amount: amount,
          description: `ได้รับเครดิตจากการแลกแต้มสะสม: ${item.name}`,
          status: 'completed'
        }]);
    }

    return NextResponse.json({
      message: 'แลกของรางวัลสำเร็จ!',
      newPoints: nextPoints,
      newBalance: nextBalance,
      rewardType: item.reward_type,
      rewardValue: codeAwarded || rewardData.amount || rewardData.discount,
    });
  } catch (error) {
    console.error('Point redemption error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแลกแต้มสะสม' }, { status: 500 });
  }
}
