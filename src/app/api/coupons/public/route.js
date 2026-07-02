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

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // 1. ดึงคูปองส่วนลดที่ใช้งานได้ทั้งหมดในระบบ
    const { data: coupons, error: couponsErr } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('is_active', true);

    if (couponsErr) throw couponsErr;

    // คัดกรองหาเฉพาะคูปองสาธารณะ
    const publicCoupons = (coupons || []).filter(c => {
      const { userId: ownerId } = parseCouponCode(c.code);
      return !ownerId;
    });

    // 2. ตรวจสอบว่าผู้ใช้งานคนนี้กดเก็บคูปองใดไปแล้วบ้าง
    const claimedCodes = new Set();
    if (userId) {
      const userClaimed = (coupons || []).filter(c => {
        const { userId: ownerId } = parseCouponCode(c.code);
        return ownerId === userId;
      });
      userClaimed.forEach(c => {
        const { baseCode } = parseCouponCode(c.code);
        claimedCodes.add(baseCode);
      });
    }

    // 3. ปรับแต่งฟิลด์และข้อมูลสถานะก่อนส่งกลับไปแสดงหน้าเว็บ
    const formatted = publicCoupons.map(c => {
      const { baseCode, limit } = parseCouponCode(c.code);
      const isClaimed = claimedCodes.has(baseCode);

      return {
        id: c.id,
        code: baseCode,
        discount: Number(c.discount),
        type: c.type || 'fixed',
        maxDiscount: c.max_discount ? Number(c.max_discount) : null,
        minPurchase: Number(c.min_purchase || 0),
        expiresAt: c.expires_at,
        maxUsesPerUser: Number(c.max_uses_per_user || 1),
        maxTotalUses: limit,
        isClaimed
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Public coupons fetch error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคูปองสาธารณะ' }, { status: 500 });
  }
}
