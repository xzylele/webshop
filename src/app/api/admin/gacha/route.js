import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { parseStockInput, validatePrizeInput } from '@/lib/gacha/validation';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'admin';
}

function formatWonCode(entry) {
  return {
    _id: entry.id,
    code: entry.code,
    wonBy: entry.users ? {
      _id: entry.won_by,
      username: entry.users.username,
      email: entry.users.email,
    } : null,
    wonAt: entry.won_at,
  };
}

function formatItem(item, usedCodes = []) {
  return {
    ...item,
    _id: item.id,
    tierId: item.tier_id,
    couponDiscount: Number(item.coupon_discount),
    topupAmount: Number(item.topup_amount || 0),
    chance: Number(item.chance),
    stock: item.stock || [],
    usedCodes,
    createdAt: item.created_at,
  };
}

async function loadWonCodes(itemId) {
  let query = supabaseAdmin.from('gacha_won_codes').select(`
    id, gacha_item_id, code, won_by, won_at,
    users:won_by (username, email)
  `);
  if (itemId) query = query.eq('gacha_item_id', itemId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function GET(request) {
  try {
    if (!await checkAdmin()) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    const tierId = request ? new URL(request.url).searchParams.get('tierId') : null;
    let query = supabaseAdmin.from('gacha_items').select('*').order('created_at', { ascending: false });
    if (tierId) query = query.eq('tier_id', tierId);
    const { data: items, error } = await query;
    if (error) throw error;

    const wonCodes = await loadWonCodes();
    const wonByItem = wonCodes.reduce((map, entry) => {
      (map[entry.gacha_item_id] ||= []).push(formatWonCode(entry));
      return map;
    }, {});
    return NextResponse.json((items || []).map(item => formatItem(item, wonByItem[item.id] || [])));
  } catch (error) {
    console.error('Admin fetch gacha items error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการโหลดรางวัล' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await checkAdmin()) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    const body = await request.json();
    const validation = validatePrizeInput(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const value = validation.value;

    const { data, error } = await supabaseAdmin.from('gacha_items').insert([{
      tier_id: value.tierId,
      name: value.name,
      type: value.type,
      chance: value.chance,
      coupon_discount: value.couponDiscount,
      topup_amount: value.topupAmount,
      stock: value.stock,
    }]).select('*').single();
    if (error) throw error;
    return NextResponse.json({ message: 'สร้างรางวัลสำเร็จ', gachaItem: formatItem(data) }, { status: 201 });
  } catch (error) {
    console.error('Admin create gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างรางวัล' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAdmin()) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ไม่พบไอดีรางวัล' }, { status: 400 });

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('gacha_items').select('*').eq('id', body.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: 'ไม่พบรางวัล' }, { status: 404 });

    const stock = Array.isArray(existing.stock) ? [...existing.stock] : [];
    if (body.appendStockInput && existing.type === 'code') {
      stock.push(...parseStockInput(body.appendStockInput));
    }
    if (body.deleteCodeIndex !== undefined && existing.type === 'code') {
      const index = Number(body.deleteCodeIndex);
      if (index >= 0 && index < stock.length) stock.splice(index, 1);
    }
    if (body.editCodeIndex !== undefined && body.editCodeValue !== undefined && existing.type === 'code') {
      const index = Number(body.editCodeIndex);
      const code = String(body.editCodeValue).trim();
      if (index >= 0 && index < stock.length && code) stock[index] = code;
    }

    const validation = validatePrizeInput({
      tierId: body.tierId ?? existing.tier_id,
      name: body.name ?? existing.name,
      type: existing.type,
      chance: body.chance ?? existing.chance,
      couponDiscount: body.couponDiscount ?? existing.coupon_discount,
      topupAmount: body.topupAmount ?? existing.topup_amount,
      stock,
    });
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const value = validation.value;

    const { data, error } = await supabaseAdmin.from('gacha_items').update({
      tier_id: value.tierId,
      name: value.name,
      chance: value.chance,
      coupon_discount: value.couponDiscount,
      topup_amount: value.topupAmount,
      stock: value.stock,
    }).eq('id', body.id).select('*').single();
    if (error) throw error;

    const wonCodes = await loadWonCodes(body.id);
    return NextResponse.json({
      message: 'อัปเดตรางวัลสำเร็จ',
      gachaItem: formatItem(data, wonCodes.map(formatWonCode)),
    });
  } catch (error) {
    console.error('Admin update gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตรางวัล' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await checkAdmin()) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ไม่พบไอดีรางวัล' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('gacha_items').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'ไม่พบรางวัล' }, { status: 404 });
    return NextResponse.json({ message: 'ลบรางวัลสำเร็จ' });
  } catch (error) {
    console.error('Admin delete gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรางวัล' }, { status: 500 });
  }
}
