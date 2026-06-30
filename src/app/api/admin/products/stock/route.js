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

export async function GET(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีสินค้า' }, { status: 400 });
    }

    // ดึงรหัสคีย์โค้ดทั้งหมดของสินค้านั้นๆ เรียงตามลำดับล่าสุด และจอยข้อมูลผู้ใช้
    const { data: codes, error: codesErr } = await supabaseAdmin
      .from('product_codes')
      .select(`
        id,
        product_id,
        code,
        is_used,
        used_by,
        transaction_id,
        created_at,
        users:used_by (username, email)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (codesErr) throw codesErr;

    const formattedCodes = codes.map(c => ({
      _id: c.id,
      id: c.id,
      product: c.product_id,
      code: c.code,
      isUsed: c.is_used,
      usedBy: c.users ? { username: c.users.username, email: c.users.email } : null,
      transaction: c.transaction_id,
      createdAt: c.created_at
    }));

    return NextResponse.json(formattedCodes);
  } catch (error) {
    console.error('Admin fetch product codes error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโค้ดสินค้า' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { productId, codesInput } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีสินค้า' }, { status: 400 });
    }

    if (!codesInput || typeof codesInput !== 'string') {
      return NextResponse.json({ error: 'กรุณากรอกรหัสสินค้า' }, { status: 400 });
    }

    // ค้นหาสินค้า
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้าในระบบ' }, { status: 404 });
    }

    if (product.stock_type !== 'code') {
      return NextResponse.json({ error: 'สินค้านี้ไม่ได้ตั้งค่าการสต็อกแบบโค้ด' }, { status: 400 });
    }

    // แปลงข้อมูลจากสายอักขระแยกบรรทัด
    const lines = codesInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: 'กรุณากรอกอย่างน้อย 1 โค้ด' }, { status: 400 });
    }

    const createdItems = lines.map(item => ({
      product_id: productId,
      code: item,
      is_used: false
    }));

    const { data: result, error: insertErr } = await supabaseAdmin
      .from('product_codes')
      .insert(createdItems)
      .select('*');

    if (insertErr) throw insertErr;

    return NextResponse.json({
      message: `นำเข้าสต็อกสำเร็จแล้ว! เพิ่มจำนวน ${result.length} รหัส`,
      count: result.length
    }, { status: 201 });
  } catch (error) {
    console.error('Admin add product codes error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกรหัสโค้ด' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');

    if (!codeId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีของรหัสโค้ดที่ต้องการลบ' }, { status: 400 });
    }

    const { data: codeInDb, error: codeErr } = await supabaseAdmin
      .from('product_codes')
      .select('*')
      .eq('id', codeId)
      .maybeSingle();

    if (codeErr) throw codeErr;
    if (!codeInDb) {
      return NextResponse.json({ error: 'ไม่พบรหัสโค้ดที่ระบุ' }, { status: 404 });
    }

    // หากโค้ดถูกลูกค้าใช้ไปแล้ว ห้ามแอดมินลบเพื่อไม่ให้สับสน
    if (codeInDb.is_used) {
      return NextResponse.json({ error: 'รหัสโค้ดนี้ถูกลูกค้าสั่งซื้อไปแล้ว ไม่สามารถลบได้' }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('product_codes')
      .delete()
      .eq('id', codeId);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ message: 'ลบรหัสคีย์โค้ดออกจากสต็อกสำเร็จ!' });
  } catch (error) {
    console.error('Admin delete product code error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบโค้ด' }, { status: 500 });
  }
}

