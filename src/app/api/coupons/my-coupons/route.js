import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนดึงข้อมูลคูปอง' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. ดึงคูปองทั้งหมดที่เป็นสิทธิ์ของตนเอง (ลงท้ายด้วย #USER_ID)
    const { data: coupons, error: couponsErr } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .like('code', `%#${userId}`)
      .order('created_at', { ascending: false });

    if (couponsErr) throw couponsErr;

    // 2. ดึงประวัติธุรกรรมเพื่อเช็คจำนวนการใช้งานคูปองของตนเอง
    const { data: txs, error: txsErr } = await supabaseAdmin
      .from('transactions')
      .select('id, coupon_id')
      .eq('user_id', userId)
      .eq('type', 'purchase')
      .eq('status', 'completed')
      .not('coupon_id', 'is', null);

    if (txsErr) throw txsErr;

    const couponUseCounts = {};
    if (txs) {
      txs.forEach(t => {
        if (t.coupon_id) {
          couponUseCounts[t.coupon_id] = (couponUseCounts[t.coupon_id] || 0) + 1;
        }
      });
    }

    // 3. ปรับรูปแบบคูปองเพื่อส่งไปแสดงผลหน้าร้านค้า
    const formattedCoupons = (coupons || []).map(c => {
      const usesCount = couponUseCounts[c.id] || 0;
      const maxUses = Number(c.max_uses_per_user || 1);
      const cleanCode = c.code.split('#')[0];

      let status = 'active'; // 'active', 'used', 'expired', 'inactive'
      if (usesCount >= maxUses) {
        status = 'used';
      } else if (c.expires_at && new Date(c.expires_at) < new Date()) {
        status = 'expired';
      } else if (!c.is_active) {
        status = 'inactive';
      }

      return {
        id: c.id,
        rawCode: c.code,
        code: cleanCode,
        discount: Number(c.discount),
        type: c.type || 'fixed',
        maxDiscount: c.max_discount ? Number(c.max_discount) : null,
        minPurchase: Number(c.min_purchase || 0),
        expiresAt: c.expires_at,
        maxUsesPerUser: maxUses,
        usesCount,
        status
      };
    });

    return NextResponse.json(formattedCoupons);
  } catch (error) {
    console.error('My coupons fetch error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคูปองของคุณ' }, { status: 500 });
  }
}
