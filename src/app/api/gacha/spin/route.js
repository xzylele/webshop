import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

const SPIN_COST = 30; // ราคาหมุนวงล้อสุ่มคงที่ 30 บาท

// GET: ดึงประวัติผู้โชคดีสุ่มรางวัลใหญ่ล่าสุด (15 รายการ) และรายการของรางวัลบนวงล้อ
export async function GET() {
  try {
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('gacha_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (logsErr) throw logsErr;

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('gacha_items')
      .select('id, name, type, chance, coupon_discount, stock')
      .order('chance', { ascending: true });

    if (itemsErr) throw itemsErr;

    const formattedLogs = logs.map(l => ({
      ...l,
      _id: l.id,
      prizeName: l.prize_name,
      createdAt: l.created_at
    }));

    const formattedItems = items.map(item => ({
      _id: item.id,
      id: item.id,
      name: item.name,
      type: item.type,
      chance: Number(item.chance),
      couponDiscount: Number(item.coupon_discount),
      stock: item.stock || []
    }));

    return NextResponse.json({ logs: formattedLogs, items: formattedItems });
  } catch (error) {
    console.error('Fetch gacha data error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลวงล้อนำโชค' }, { status: 500 });
  }
}

// POST: ทำการสุ่มวงล้อ Gacha
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    // โหลดข้อมูลผู้ใช้
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    if (Number(user.balance) < SPIN_COST) {
      return NextResponse.json({ error: 'ยอดเงินคงเหลือไม่เพียงพอ (ต้องการ 30 THB)' }, { status: 400 });
    }

    // โหลดรายการสุ่มทั้งหมด
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('gacha_items')
      .select('*');

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'ยังไม่มีการตั้งค่าของรางวัลในตารางสุ่ม' }, { status: 400 });
    }

    // คำนวณหาผลลัพธ์แบบถ่วงน้ำหนัก (Weighted Random Selection)
    const totalWeight = items.reduce((sum, item) => sum + Number(item.chance), 0);
    if (totalWeight <= 0) {
      return NextResponse.json({ error: 'อัตราการสุ่มรางวัลทั้งหมดมีค่าเป็น 0' }, { status: 400 });
    }

    let randomNum = Math.random() * totalWeight;
    let selectedItem = null;

    for (const item of items) {
      randomNum -= Number(item.chance);
      if (randomNum <= 0) {
        selectedItem = item;
        break;
      }
    }

    // หากไม่พบตัวที่เลือก ให้ดีฟอลต์เป็นตัวแรกสุด
    if (!selectedItem) {
      selectedItem = items[0];
    }

    let stockArray = Array.isArray(selectedItem.stock) ? selectedItem.stock : [];

    // ลอจิกตรวจสอบกรณีสต็อกโค้ดรางวัลหมดเกลี้ยง
    if (selectedItem.type === 'code' && stockArray.length === 0) {
      const emptyFallback = items.find(i => i.type === 'empty');
      if (emptyFallback) {
        selectedItem = emptyFallback;
        stockArray = Array.isArray(selectedItem.stock) ? selectedItem.stock : [];
      } else {
        return NextResponse.json({ error: 'ของรางวัลสุ่มในสต็อกหมดชั่วคราว กรุณาแจ้งแอดมิน' }, { status: 400 });
      }
    }

    let wonValue = '';

    // จัดการการส่งมอบตามประเภทของรางวัลที่ได้รับ
    if (selectedItem.type === 'empty') {
      wonValue = 'เกลือ (ขอบคุณสำหรับความร่วมมือ)';
    } else if (selectedItem.type === 'coupon') {
      const generatedCode = `GACHA-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const { error: couponErr } = await supabaseAdmin
        .from('coupons')
        .insert([
          {
            code: `${generatedCode}#${user.id}`,
            discount: Number(selectedItem.coupon_discount) || 10,
            max_uses_per_user: 1,
            is_active: true
          }
        ]);
      if (couponErr) throw couponErr;
      wonValue = generatedCode;
    } else if (selectedItem.type === 'code') {
      const code = stockArray.shift();
      
      const { error: updateGachaErr } = await supabaseAdmin
        .from('gacha_items')
        .update({ stock: stockArray })
        .eq('id', selectedItem.id);
      
      if (updateGachaErr) throw updateGachaErr;

      const { error: wonCodeErr } = await supabaseAdmin
        .from('gacha_won_codes')
        .insert([
          {
            gacha_item_id: selectedItem.id,
            code: code,
            won_by: user.id
          }
        ]);
      
      if (wonCodeErr) throw wonCodeErr;
      wonValue = code;
    }

    // หักเงินผู้ใช้ และบวกสะสมยอดใช้จ่ายจริง (totalSpent)
    const nextBalance = Number(user.balance) - SPIN_COST;
    const nextTotalSpent = (Number(user.total_spent) || 0) + SPIN_COST;
    
    const { error: userUpdateErr } = await supabaseAdmin
      .from('users')
      .update({
        balance: nextBalance,
        total_spent: nextTotalSpent
      })
      .eq('id', user.id);

    if (userUpdateErr) throw userUpdateErr;

    // บันทึกธุรกรรมประวัติลูกค้า
    const description = `[สุ่มวงล้อ Gacha] สุ่มได้: ${selectedItem.name}${selectedItem.type !== 'empty' ? ` (ของรางวัล: ${wonValue})` : ''}`;
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'purchase',
          amount: -SPIN_COST,
          description,
          status: 'completed'
        }
      ])
      .select('*')
      .single();

    if (txError) throw txError;

    // บันทึกประวัติผู้โชคดีสาธารณะ (ยกเว้นเกลือ เพื่อความพรีเมียมของกระดานผู้โชคดี)
    if (selectedItem.type !== 'empty') {
      const { error: logErr } = await supabaseAdmin
        .from('gacha_logs')
        .insert([
          {
            username: user.username,
            prize_name: selectedItem.name
          }
        ]);
      if (logErr) throw logErr;
    }

    return NextResponse.json({
      message: 'หมุนวงล้อสำเร็จ!',
      itemId: selectedItem.id,
      prizeName: selectedItem.name,
      type: selectedItem.type,
      wonValue,
      newBalance: nextBalance,
      transactionId: transaction.id
    });
  } catch (error) {
    console.error('Gacha spin error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลหมุนวงล้อ' }, { status: 500 });
  }
}

