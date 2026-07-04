import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getTierReadiness } from '@/lib/gacha/rules';

function formatItem(item) {
  return {
    _id: item.id,
    id: item.id,
    tierId: item.tier_id,
    name: item.name,
    type: item.type,
    chance: Number(item.chance),
    couponDiscount: Number(item.coupon_discount),
    topupAmount: Number(item.topup_amount || 0),
    stock: item.stock || [],
  };
}

export async function GET() {
  try {
    const [tierResult, itemResult, logResult] = await Promise.all([
      supabaseAdmin.from('gacha_tiers').select('*').order('sort_order').order('created_at'),
      supabaseAdmin.from('gacha_items').select('id, tier_id, name, type, chance, coupon_discount, topup_amount, stock, created_at').order('created_at'),
      supabaseAdmin.from('gacha_logs').select('*').order('created_at', { ascending: false }).limit(15),
    ]);
    if (tierResult.error) throw tierResult.error;
    if (itemResult.error) throw itemResult.error;
    if (logResult.error) throw logResult.error;

    const allItems = (itemResult.data || []).map(formatItem);
    const tiers = (tierResult.data || []).map(tier => {
      const items = allItems.filter(item => item.tierId === tier.id);
      const readiness = getTierReadiness({ isActive: tier.is_active, price: Number(tier.price) }, items);
      return {
        id: tier.id,
        _id: tier.id,
        name: tier.name,
        slug: tier.slug,
        price: Number(tier.price),
        isActive: tier.is_active,
        sortOrder: tier.sort_order,
        items,
        ...readiness,
      };
    });
    const logs = (logResult.data || []).map(log => ({
      ...log,
      _id: log.id,
      prizeName: log.prize_name,
      tierId: log.tier_id,
      tierName: log.tier_name,
      tierPrice: Number(log.tier_price),
      createdAt: log.created_at,
    }));

    return NextResponse.json({ tiers, logs });
  } catch (error) {
    console.error('Fetch gacha data error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลกาชา' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });

    const { tierId } = await request.json();
    if (!tierId || typeof tierId !== 'string') {
      return NextResponse.json({ error: 'กรุณาเลือกระดับกาชา' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('spin_gacha', {
      p_user_id: session.user.id,
      p_tier_id: tierId,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === 'P0001' ? 409 : 400;
      return NextResponse.json({ error: error.message || 'ไม่สามารถสุ่มกาชาได้' }, { status });
    }
    return NextResponse.json({ message: 'สุ่มกาชาสำเร็จ', ...data });
  } catch (error) {
    console.error('Gacha spin error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลสุ่มกาชา' }, { status: 500 });
  }
}
