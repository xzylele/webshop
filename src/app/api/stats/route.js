import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // ดึงสถิติต่างๆ แบบขนาน
    const [
      { count: totalUsers, error: userCountErr },
      { data: products, count: totalProducts, error: prodErr },
      { count: unusedCodesCount, error: codesErr }
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('stock, stock_type, sold', { count: 'exact' }),
      supabaseAdmin.from('product_codes').select('*', { count: 'exact', head: true }).eq('is_used', false)
    ]);

    if (userCountErr) throw userCountErr;
    if (prodErr) throw prodErr;
    if (codesErr) throw codesErr;

    let totalStock = 0;
    let totalSold = 0;

    if (products) {
      products.forEach(p => {
        if (p.stock_type === 'manual') {
          totalStock += Math.max(0, Number(p.stock) || 0);
        }
        totalSold += Math.max(0, Number(p.sold) || 0);
      });
    }

    // บวกจำนวนรหัสโค้ดที่พร้อมจำหน่ายในระบบ
    totalStock += (unusedCodesCount || 0);

    return NextResponse.json(
      {
        users: totalUsers ?? 0,
        products: totalProducts ?? 0,
        stock: totalStock,
        sold: totalSold
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงสถิติ' }, { status: 500 });
  }
}

