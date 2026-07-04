import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('products').select('*');

    if (category) {
      query = query.eq('category', category);
    }
    
    if (subcategory) {
      query = query.eq('subcategory', subcategory);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: products, error: productsError } = await query.order('created_at', { ascending: false });

    if (productsError) throw productsError;

    // ดึงยอดสต็อกจริงของสินค้าที่เป็นแบบ "สต็อกตามโค้ดคีย์จริง"
    const { data: codeStocks, error: codesError } = await supabaseAdmin
      .from('product_codes')
      .select('product_id')
      .eq('is_used', false);

    if (codesError) throw codesError;

    const codeCounts = {};
    if (codeStocks) {
      codeStocks.forEach(item => {
        const pId = item.product_id;
        codeCounts[pId] = (codeCounts[pId] || 0) + 1;
      });
    }

    const plainProducts = products.map(p => {
      const plain = {
        ...p,
        _id: p.id, // ให้มีทั้ง _id และ id ป้องกัน UI พัง
        stockType: p.stock_type,
        createdAt: p.created_at
      };
      if (plain.stockType === 'code') {
        plain.stock = codeCounts[p.id] || 0;
      }
      return plain;
    });

    return NextResponse.json(plainProducts);
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' }, { status: 500 });
  }
}

