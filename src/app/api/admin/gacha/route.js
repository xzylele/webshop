import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('gacha_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (itemsErr) throw itemsErr;

    // ดึงประวัติผู้ที่สุ่มได้รหัสโค้ดเพื่อเอาไปแสดง/จอยข้อมูลผู้ใช้
    const { data: wonCodes, error: wonErr } = await supabaseAdmin
      .from('gacha_won_codes')
      .select(`
        id,
        gacha_item_id,
        code,
        won_by,
        won_at,
        users:won_by (username, email)
      `);

    if (wonErr) throw wonErr;

    const wonCodesMap = {};
    if (wonCodes) {
      wonCodes.forEach(w => {
        if (!wonCodesMap[w.gacha_item_id]) {
          wonCodesMap[w.gacha_item_id] = [];
        }
        wonCodesMap[w.gacha_item_id].push({
          _id: w.id,
          code: w.code,
          wonBy: w.users ? { _id: w.won_by, username: w.users.username, email: w.users.email } : null,
          wonAt: w.won_at
        });
      });
    }

    const formattedItems = items.map(item => ({
      ...item,
      _id: item.id,
      couponDiscount: Number(item.coupon_discount),
      chance: Number(item.chance),
      stock: item.stock || [],
      usedCodes: wonCodesMap[item.id] || [],
      createdAt: item.created_at
    }));

    return NextResponse.json(formattedItems);
  } catch (error) {
    console.error('Admin fetch gacha items error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสุ่มรางวัล' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { name, type, chance, couponDiscount, stockInput } = await request.json();

    if (!name || !type || chance === undefined) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 });
    }

    let initialStock = [];
    if (type === 'code' && stockInput) {
      initialStock = stockInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }

    const { data: gachaItem, error: createErr } = await supabaseAdmin
      .from('gacha_items')
      .insert([
        {
          name,
          type,
          chance: Number(chance) || 10,
          coupon_discount: type === 'coupon' ? (Number(couponDiscount) || 0) : 0,
          stock: initialStock
        }
      ])
      .select('*')
      .single();

    if (createErr) throw createErr;

    const formattedItem = {
      ...gachaItem,
      _id: gachaItem.id,
      couponDiscount: Number(gachaItem.coupon_discount),
      chance: Number(gachaItem.chance),
      stock: gachaItem.stock || [],
      usedCodes: [],
      createdAt: gachaItem.created_at
    };

    return NextResponse.json({ message: 'สร้างของรางวัลสุ่มสำเร็จ!', gachaItem: formattedItem }, { status: 201 });
  } catch (error) {
    console.error('Admin create gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างของรางวัล' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { id, name, chance, couponDiscount, appendStockInput, deleteCodeIndex, editCodeIndex, editCodeValue } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบไอดีของรางวัลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const { data: gachaItem, error: fetchErr } = await supabaseAdmin
      .from('gacha_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!gachaItem) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลของรางวัลที่ระบุ' }, { status: 404 });
    }

    let stockArray = Array.isArray(gachaItem.stock) ? gachaItem.stock : [];
    let updates = {};

    if (name !== undefined) updates.name = name;
    if (chance !== undefined) updates.chance = Number(chance);
    if (couponDiscount !== undefined) updates.coupon_discount = Number(couponDiscount);

    // 1. เติมโค้ดเพิ่มเป็นชุด
    if (appendStockInput && gachaItem.type === 'code') {
      const extraCodes = appendStockInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      stockArray = [...stockArray, ...extraCodes];
      updates.stock = stockArray;
    }

    // 2. ลบโค้ดรายตัวออกจากสต็อกของรางวัลสุ่ม
    if (deleteCodeIndex !== undefined && gachaItem.type === 'code') {
      const idx = Number(deleteCodeIndex);
      if (idx >= 0 && idx < stockArray.length) {
        stockArray.splice(idx, 1);
        updates.stock = stockArray;
      }
    }

    // 3. พิมพ์แก้ไขโค้ดเดิมในคลังสุ่ม
    if (editCodeIndex !== undefined && editCodeValue !== undefined && gachaItem.type === 'code') {
      const idx = Number(editCodeIndex);
      if (idx >= 0 && idx < stockArray.length) {
        stockArray[idx] = editCodeValue.trim();
        updates.stock = stockArray;
      }
    }

    const { data: updatedItem, error: updateErr } = await supabaseAdmin
      .from('gacha_items')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    // ดึงข้อมูลผู้โชคดีวงล้อที่สุ่มไอเทมนี้ได้เพื่อส่งกลับ
    const { data: wonCodes, error: wonErr } = await supabaseAdmin
      .from('gacha_won_codes')
      .select(`
        id,
        gacha_item_id,
        code,
        won_by,
        won_at,
        users:won_by (username, email)
      `)
      .eq('gacha_item_id', id);

    if (wonErr) throw wonErr;

    const formattedWonCodes = (wonCodes || []).map(w => ({
      _id: w.id,
      code: w.code,
      wonBy: w.users ? { _id: w.won_by, username: w.users.username, email: w.users.email } : null,
      wonAt: w.won_at
    }));

    const formattedItem = {
      ...updatedItem,
      _id: updatedItem.id,
      couponDiscount: Number(updatedItem.coupon_discount),
      chance: Number(updatedItem.chance),
      stock: updatedItem.stock || [],
      usedCodes: formattedWonCodes,
      createdAt: updatedItem.created_at
    };

    return NextResponse.json({ message: 'อัปเดตของรางวัลสำเร็จ!', gachaItem: formattedItem });
  } catch (error) {
    console.error('Admin update gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลของรางวัล' }, { status: 500 });
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
      return NextResponse.json({ error: 'ไม่พบไอดีของรางวัลที่ต้องการลบ' }, { status: 400 });
    }

    const { data: deletedItem, error: delFetchErr } = await supabaseAdmin
      .from('gacha_items')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (delFetchErr) throw delFetchErr;
    if (!deletedItem) {
      return NextResponse.json({ error: 'ไม่พบของรางวัลที่ระบุในคลังสุ่ม' }, { status: 404 });
    }

    return NextResponse.json({ message: 'ลบของรางวัลสุ่มเรียบร้อยแล้ว!' });
  } catch (error) {
    console.error('Admin delete gacha item error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบของรางวัล' }, { status: 500 });
  }
}

