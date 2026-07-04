import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { data: banners, error } = await supabaseAdmin
      .from('banners')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const mappedBanners = banners.map(b => ({
      ...b,
      _id: b.id,
      image: b.image_url,
      href: b.link_url,
      action: b.action_text,
      desc: b.description
    }));

    return NextResponse.json(mappedBanners);
  } catch (error) {
    console.error('Fetch public banners error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Banner' }, { status: 500 });
  }
}
