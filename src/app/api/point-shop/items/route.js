import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('point_items')
      .select('*')
      .eq('is_active', true)
      .order('point_cost', { ascending: true });

    if (error) throw error;

    return NextResponse.json(items || []);
  } catch (error) {
    console.error('Fetch point items error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าพอยท์ช็อป' }, { status: 500 });
  }
}
