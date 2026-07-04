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

    const { data: coupons, error: couponsErr } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (couponsErr) throw couponsErr;

    const formattedCoupons = coupons.map(c => ({
      ...c,
      _id: c.id,
      isActive: c.is_active,
      createdAt: c.created_at,
      discount: Number(c.discount),
      type: c.type || 'fixed',
      maxDiscount: c.max_discount ? Number(c.max_discount) : null,
      minPurchase: Number(c.min_purchase || 0),
      expiresAt: c.expires_at,
      maxUsesPerUser: Number(c.max_uses_per_user || 1)
    }));

    return NextResponse.json(formattedCoupons);
  } catch (error) {
    console.error('Admin fetch coupons error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคูปอง' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { code, discount, type, maxDiscount, minPurchase, expiresAt, maxUsesPerUser } = await request.json();

    if (!code || discount === undefined || discount < 0) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสคูปองและมูลค่าส่วนลดให้ถูกต้อง' }, { status: 400 });
    }

    const uppercaseCode = code.trim().toUpperCase();
    const { data: couponExists, error: existErr } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', uppercaseCode)
      .maybeSingle();

    if (existErr) throw existErr;
    
    if (couponExists) {
      return NextResponse.json({ error: 'รหัสคูปองนี้ถูกใช้งานไปแล้ว' }, { status: 400 });
    }

    const { data: coupon, error: createErr } = await supabaseAdmin
      .from('coupons')
      .insert([
        {
          code: uppercaseCode,
          discount: Number(discount),
          type: type || 'fixed',
          max_discount: maxDiscount ? Number(maxDiscount) : null,
          min_purchase: minPurchase ? Number(minPurchase) : 0,
          expires_at: expiresAt || null,
          max_uses_per_user: maxUsesPerUser !== undefined ? Number(maxUsesPerUser) : 1,
          is_active: true
        }
      ])
      .select('*')
      .single();

    if (createErr) throw createErr;

    const formattedCoupon = {
      ...coupon,
      _id: coupon.id,
      isActive: coupon.is_active,
      createdAt: coupon.created_at,
      discount: Number(coupon.discount),
      type: coupon.type,
      maxDiscount: coupon.max_discount ? Number(coupon.max_discount) : null,
      minPurchase: Number(coupon.min_purchase || 0),
      expiresAt: coupon.expires_at,
      maxUsesPerUser: Number(coupon.max_uses_per_user || 1)
    };

    return NextResponse.json({ message: 'สร้างคูปองสำเร็จแล้ว!', coupon: formattedCoupon }, { status: 201 });
  } catch (error) {
    console.error('Admin create coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคูปอง' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { id, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบไอดีคูปองที่ต้องการแก้ไข' }, { status: 400 });
    }

    const { data: coupon, error: updateErr } = await supabaseAdmin
      .from('coupons')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateErr) throw updateErr;

    if (!coupon) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลคูปองที่ระบุ' }, { status: 404 });
    }

    const formattedCoupon = {
      ...coupon,
      _id: coupon.id,
      isActive: coupon.is_active,
      createdAt: coupon.created_at,
      discount: Number(coupon.discount)
    };

    return NextResponse.json({ message: 'อัปเดตคูปองสำเร็จแล้ว!', coupon: formattedCoupon });
  } catch (error) {
    console.error('Admin update coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตคูปอง' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบไอดีคูปองที่ต้องการลบ' }, { status: 400 });
    }

    const { data: coupon, error: fetchErr } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!coupon) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลคูปองในระบบ' }, { status: 404 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('coupons')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ message: 'ลบคูปองส่วนลดเรียบร้อยแล้ว!' });
  } catch (error) {
    console.error('Admin delete coupon error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบคูปอง' }, { status: 500 });
  }
}

