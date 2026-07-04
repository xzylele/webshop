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

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const uppercaseCode = code.trim().toUpperCase();

    // ค้นหาคูปอง: ลองหาแบบคูปองส่วนตัวของลูกค้าก่อน (มี #USER_ID) แล้วค่อยหาแบบสาธารณะ (มี/ไม่มี #LIMIT)
    const { data: coupons, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .or(`code.eq.${uppercaseCode},code.like.${uppercaseCode}#%`)
      .eq('is_active', true);

    if (error) throw error;

    let coupon = null;
    if (coupons && coupons.length > 0) {
      if (userId) {
        coupon = coupons.find(c => c.code === `${uppercaseCode}#${userId}`);
      }
      if (!coupon) {
        coupon = coupons.find(c => {
          const parts = c.code.split('#');
          const suffix = parts[1];
          return !suffix || /^[0-9]+$/.test(suffix);
        });
      }
    }

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
    if (userId) {
      const { count, error: countErr } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('coupon_id', coupon.id);

      if (countErr) throw countErr;

      const maxUses = coupon.max_uses_per_user || 1;
      if (count !== null && count >= maxUses) {
        return NextResponse.json({ 
          error: `คุณใช้สิทธิ์คูปองนี้ครบขีดจำกัดแล้ว (จำกัด ${maxUses} ครั้งต่อคน)` 
        }, { status: 400 });
      }
    }

    // 4. ตรวจสอบจำนวนสิทธิ์การใช้ของทั้งระบบ (ถ้าคูปองมีขีดจำกัดจำนวนครั้งรวมระบุไว้)
    const parts = coupon.code.split('#');
    const suffix = parts[1];
    const maxTotalUses = suffix && /^[0-9]+$/.test(suffix) ? parseInt(suffix, 10) : null;
    if (maxTotalUses !== null) {
      const relatedCouponIds = coupons.map(c => c.id);
      const { count: totalUsesCount, error: countErr } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('coupon_id', relatedCouponIds);

      if (countErr) throw countErr;

      if (totalUsesCount >= maxTotalUses) {
        return NextResponse.json({ error: 'ขออภัย คูปองนี้ถูกใช้งานสิทธิ์ครบตามจำนวนที่ระบบตั้งไว้แล้ว' }, { status: 400 });
      }
    }

    // 5. คำนวณมูลค่าส่วนลดที่จะได้รับจริง
    let calculatedDiscount = 0;
    if (coupon.type === 'percentage') {
      if (totalPrice) {
        calculatedDiscount = Math.round(Number(totalPrice) * (Number(coupon.discount) / 100));
        if (coupon.max_discount) {
          calculatedDiscount = Math.min(calculatedDiscount, Number(coupon.max_discount));
        }
      } else {
        calculatedDiscount = 0;
      }
    } else {
      calculatedDiscount = Number(coupon.discount);
    }

    return NextResponse.json({
      message: 'ใช้รหัสคูปองส่วนลดสำเร็จแล้ว!',
      id: coupon.id,
      code: uppercaseCode,
      type: coupon.type,
      discount: calculatedDiscount,
      rawDiscount: Number(coupon.discount),
      maxDiscount: coupon.max_discount ? Number(coupon.max_discount) : null
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบคูปอง' }, { status: 500 });
  }
}

