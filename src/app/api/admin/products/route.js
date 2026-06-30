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

export async function POST(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const data = await request.json();
    const { name, description, price, image, category, subcategory, stock, stockType, initialCodes } = data;

    if (!name || !description || !price || !image || !category || !subcategory) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 });
    }

    const targetStockType = stockType || 'manual';

    const { data: product, error: createErr } = await supabaseAdmin
      .from('products')
      .insert([
        {
          name,
          description,
          price: Number(price),
          image,
          category,
          subcategory,
          stock: targetStockType === 'code' ? 0 : (Number(stock) || 0),
          stock_type: targetStockType,
          sold: 0
        }
      ])
      .select('*')
      .single();

    if (createErr) throw createErr;

    // หากมีการป้อนคีย์รหัสเริ่มต้นเข้ามา
    if (targetStockType === 'code' && initialCodes && typeof initialCodes === 'string') {
      const lines = initialCodes
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (lines.length > 0) {
        const createdItems = lines.map(item => ({
          product_id: product.id,
          code: item,
          is_used: false
        }));
        
        const { error: codesErr } = await supabaseAdmin
          .from('product_codes')
          .insert(createdItems);

        if (codesErr) throw codesErr;
      }
    }

    const formattedProduct = {
      ...product,
      _id: product.id,
      stockType: product.stock_type,
      createdAt: product.created_at
    };

    return NextResponse.json({ message: 'เพิ่มสินค้าสำเร็จแล้ว!', product: formattedProduct }, { status: 201 });
  } catch (error) {
    console.error('Admin create product error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const data = await request.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบไอดีสินค้าที่ต้องการแก้ไข' }, { status: 400 });
    }

    const updates = {
      name: updateData.name,
      description: updateData.description,
      price: Number(updateData.price),
      image: updateData.image,
      category: updateData.category,
      subcategory: updateData.subcategory,
      stock: updateData.stockType === 'code' ? 0 : (Number(updateData.stock) || 0),
      stock_type: updateData.stockType || 'manual'
    };

    const { data: product, error: updateErr } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateErr) throw updateErr;

    if (!product) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสินค้าที่ระบุ' }, { status: 404 });
    }

    const formattedProduct = {
      ...product,
      _id: product.id,
      stockType: product.stock_type,
      createdAt: product.created_at
    };

    return NextResponse.json({ message: 'แก้ไขสินค้าสำเร็จแล้ว!', product: formattedProduct });
  } catch (error) {
    console.error('Admin update product error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขสินค้า' }, { status: 500 });
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
      return NextResponse.json({ error: 'ไม่พบไอดีสินค้าที่ต้องการลบ' }, { status: 400 });
    }

    const { data: product, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้าที่ระบุในคลัง' }, { status: 404 });
    }

    // ลบคีย์ทั้งหมดที่เชื่อมโยงกับสินค้าชิ้นนี้เพื่อความสะอาดของ DB
    const { error: deleteCodesErr } = await supabaseAdmin
      .from('product_codes')
      .delete()
      .eq('product_id', id);

    if (deleteCodesErr) throw deleteCodesErr;

    // ลบสินค้า
    const { error: deleteProdErr } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteProdErr) throw deleteProdErr;

    return NextResponse.json({ message: 'ลบสินค้าเรียบร้อยแล้ว!' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบสินค้า' }, { status: 500 });
  }
}

