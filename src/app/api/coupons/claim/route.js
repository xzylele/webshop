import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

function parseCouponCode(codeStr) {
  const parts = codeStr.split('#');
  const baseCode = parts[0];
  const suffix = parts[1] || null;
  let limit = null;
  let userId = null;
  if (suffix) {
    if (/^[0-9]+$/.test(suffix)) {
      limit = parseInt(suffix, 10);
    } else {
      userId = suffix;
    }
  }
  return { baseCode, limit, userId };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนเก็บคูปอง' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสคูปอง' }, { status: 400 });
    }

    const uppercaseCode = code.trim().toUpperCase();

    // 1. ดึงคูปองส่วนตัวที่เคยเคลมไปแล้วมาตรวจสอบก่อน เพื่อป้องกันการเคลมซ้ำ
    const userCouponCode = `${uppercaseCode}#${session.user.id}`;
    const { data: alreadyClaimed, error: claimExistErr } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', userCouponCode)
      .maybeSingle();

    if (claimExistErr) throw claimExistErr;
    if (alreadyClaimed) {
      return NextResponse.json({ error: 'คุณเคยเก็บคูปองส่วนลดนี้ไปแล้ว' }, { status: 400 });
    }

    // 2. ดึงข้อมูลคูปองต้นฉบับที่เป็นสาธารณะ
    const { data: coupons, error: fetchErr } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .or(`code.eq.${uppercaseCode},code.like.${uppercaseCode}#%`)
      .eq('is_active', true);

    if (fetchErr) throw fetchErr;

    // คัดกรองหาคูปองสาธารณะ (ที่ไม่มี USER_ID ต่อท้าย)
    const publicCoupon = (coupons || []).find(c => {
      const { userId } = parseCouponCode(c.code);
      return !userId;
    });

    if (!publicCoupon) {
      return NextResponse.json({ error: 'ไม่พบคูปองส่วนลดนี้ หรือ ถูกปิดใช้งานไปแล้ว' }, { status: 404 });
    }

    // 3. ตรวจสอบวันหมดอายุ
    if (publicCoupon.expires_at && new Date(publicCoupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'คูปองนี้หมดอายุการใช้งานแล้ว' }, { status: 400 });
    }

    // 4. ตรวจสอบขีดจำกัดจำนวนสิทธิ์การใช้ของทั้งระบบ (ถ้ามีระบุไว้หลังเครื่องหมาย #)
    const { limit: maxTotalUses } = parseCouponCode(publicCoupon.code);
    if (maxTotalUses !== null) {
      // ดึงคูปองทั้งหมดที่เป็นประเภทเดียวกัน (โค้ดดั้งเดิม หรือโค้ดที่เคลมไปแล้ว)
      const relatedCouponIds = (coupons || []).map(c => c.id);
      
      const { count: totalUsesCount, error: countErr } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('coupon_id', relatedCouponIds);

      if (countErr) throw countErr;

      if (totalUsesCount >= maxTotalUses) {
        return NextResponse.json({ error: 'ขออภัย คูปองนี้ถูกสิทธิ์ผู้ใช้งานครบเต็มจำนวนทั้งหมดแล้ว' }, { status: 400 });
      }
    }

    // 5. บันทึกสำเนาคูปองส่วนตัวสำหรับผู้ใช้งานคนนี้
    const { error: insertErr } = await supabaseAdmin
      .from('coupons')
      .insert([
        {
          code: userCouponCode,
          discount: Number(publicCoupon.discount),
          type: publicCoupon.type || 'fixed',
          max_discount: publicCoupon.max_discount ? Number(publicCoupon.max_discount) : null,
          min_purchase: Number(publicCoupon.min_purchase || 0),
          expires_at: publicCoupon.expires_at || null,
          max_uses_per_user: Number(publicCoupon.max_uses_per_user || 1),
          is_active: true
        }
      ]);

    if (insertErr) throw insertErr;

    return NextResponse.json({
      message: 'เก็บคูปองส่วนลดสำเร็จแล้ว! สามารถเลือกใช้ตอนชำระเงินได้เลย'
    });
  } catch (error) {
    console.error('Claim coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเก็บคูปอง' }, { status: 500 });
  }
}
