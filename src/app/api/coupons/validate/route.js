import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { code, totalPrice } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสคูปอง' }, { status: 400 });
    }

    const uppercaseCode = code.trim().toUpperCase();
    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', uppercaseCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!coupon) {
      return NextResponse.json({ error: 'รหัสคูปองไม่ถูกต้อง หรือ ถูกปิดใช้งานไปแล้ว' }, { status: 404 });
    }

    // 1. ตรวจสอบวันหมดอายุ
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'รหัสคูปองนี้หมดอายุการใช้งานแล้ว' }, { status: 400 });
    }

    // 2. ตรวจสอบยอดซื้อขั้นต่ำ
    if (totalPrice !== undefined && Number(totalPrice) < Number(coupon.min_purchase)) {
      return NextResponse.json({ 
        error: `ยอดซื้อขั้นต่ำสำหรับการใช้คูปองนี้คือ ${coupon.min_purchase} บาท (ยอดซื้อปัจจุบันของคุณคือ ${totalPrice} บาท)` 
      }, { status: 400 });
    }

    // 3. ตรวจสอบจำนวนสิทธิ์ใช้งานต่อผู้ใช้ (ถ้าล็อกอิน)
    const session = await getServerSession(authOptions);
    if (session && session.user) {
      const { count, error: countErr } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('coupon_id', coupon.id);

      if (countErr) throw countErr;

      const maxUses = coupon.max_uses_per_user || 1;
      if (count !== null && count >= maxUses) {
        return NextResponse.json({ 
          error: `คุณใช้สิทธิ์คูปองนี้ครบขีดจำกัดแล้ว (จำกัด ${maxUses} ครั้งต่อคน)` 
        }, { status: 400 });
      }
    }

    // 4. คำนวณมูลค่าส่วนลดที่จะได้รับจริง
    let calculatedDiscount = 0;
    if (coupon.type === 'percentage') {
      if (totalPrice) {
        calculatedDiscount = Math.round(Number(totalPrice) * (Number(coupon.discount) / 100));
        if (coupon.max_discount) {
          calculatedDiscount = Math.min(calculatedDiscount, Number(coupon.max_discount));
        }
      } else {
        // หากยังไม่มีการส่งราคารวมเข้ามา ให้บอก % ก่อน
        calculatedDiscount = 0;
      }
    } else {
      calculatedDiscount = Number(coupon.discount);
    }

    return NextResponse.json({
      message: 'ใช้รหัสคูปองส่วนลดสำเร็จแล้ว!',
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: calculatedDiscount,
      rawDiscount: Number(coupon.discount), // ส่ง % หรือมูลค่าดิบไปแสดงผลต่อ
      maxDiscount: coupon.max_discount ? Number(coupon.max_discount) : null
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบคูปอง' }, { status: 500 });
  }
}

