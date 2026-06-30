import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const { data: banners, error } = await supabaseAdmin
      .from('banners')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Map database properties to match Mongoose compatibility if needed (e.g. mapping id to _id)
    const mappedBanners = banners.map(b => ({
      ...b,
      _id: b.id
    }));

    return NextResponse.json(mappedBanners);
  } catch (error) {
    console.error('Fetch admin banners error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Banner' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, image_url, link_url, action_text } = body;

    if (!image_url) {
      return NextResponse.json({ error: 'กรุณาระบุรูปภาพแบนเนอร์' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('banners')
      .insert([{
        title: title || '',
        description: description || '',
        image_url,
        link_url: link_url || '/products',
        action_text: action_text || 'ดูสินค้าทั้งหมด'
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'สร้างแบนเนอร์สำเร็จ', banner: data[0] });
  } catch (error) {
    console.error('Create admin banner error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างแบนเนอร์' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const body = await request.json();
    const { id, title, description, image_url, link_url, action_text } = body;

    if (!id || !image_url) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('banners')
      .update({
        title: title || '',
        description: description || '',
        image_url,
        link_url: link_url || '',
        action_text: action_text || ''
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ message: 'แก้ไขแบนเนอร์สำเร็จ', banner: data[0] });
  } catch (error) {
    console.error('Update admin banner error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขแบนเนอร์' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบ ID แบนเนอร์' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('banners')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'ลบแบนเนอร์สำเร็จ' });
  } catch (error) {
    console.error('Delete admin banner error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบแบนเนอร์' }, { status: 500 });
  }
}
