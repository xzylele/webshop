import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return null;
  }
  return session;
}

export async function GET() {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { data: notifications, error } = await supabaseAdmin
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const { count: unreadCount, error: countErr } = await supabaseAdmin
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (countErr) throw countErr;

    const formatted = (notifications || []).map((n) => ({
      ...n,
      _id: n.id,
      createdAt: n.created_at,
    }));

    return NextResponse.json({
      notifications: formatted,
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Fetch admin notifications error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงการแจ้งเตือน' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const body = await request.json();
    const { id, markAll } = body;

    if (markAll) {
      const { error } = await supabaseAdmin
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      return NextResponse.json({ message: 'อ่านการแจ้งเตือนทั้งหมดแล้ว' });
    }

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีการแจ้งเตือน' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ message: 'อ่านการแจ้งเตือนแล้ว' });
  } catch (error) {
    console.error('Update admin notification error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตการแจ้งเตือน' }, { status: 500 });
  }
}
