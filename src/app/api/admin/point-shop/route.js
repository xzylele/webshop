import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

// ตรวจสอบสิทธิ์แอดมิน
async function verifyAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function GET() {
  try {
    await verifyAdmin();

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('point_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (itemsErr) throw itemsErr;

    const { data: x2Setting } = await supabaseAdmin
      .from('global_settings')
      .select('*')
      .eq('key', 'double_points_event')
      .maybeSingle();

    const isX2Active = x2Setting ? (x2Setting.value === true || x2Setting.value === 'true') : false;

    // ดึงธุรกรรมการแลกพอยท์ 100 รายการล่าสุด
    const { data: pointTransactions, error: txsErr } = await supabaseAdmin
      .from('point_transactions')
      .select('*, users(username, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (txsErr) throw txsErr;

    const formattedTxs = (pointTransactions || []).map(tx => ({
      ...tx,
      user: tx.users || null
    }));

    return NextResponse.json({ 
      items: items || [], 
      isX2Active,
      transactions: formattedTxs
    });
  } catch (error) {
    console.error('Admin point-shop GET error:', error);
    return NextResponse.json({ error: error.message === 'Unauthorized' ? 'ไม่มีสิทธิ์เข้าถึง' : 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: error.message === 'Unauthorized' ? 403 : 500 });
  }
}

export async function POST(request) {
  try {
    await verifyAdmin();
    const body = await request.json();

    // จัดการเปลี่ยนสถานะการตั้งค่ากิจกรรมแต้มคูณสอง (X2 Event)
    if (body.action === 'toggle_x2') {
      const activeVal = body.active === true || body.active === 'true';
      const { error: settingsErr } = await supabaseAdmin
        .from('global_settings')
        .upsert({ key: 'double_points_event', value: activeVal });

      if (settingsErr) throw settingsErr;

      return NextResponse.json({ message: `เปลี่ยนสถานะกิจกรรมแต้มคูณสองเป็น ${activeVal ? 'เปิด' : 'ปิด'} เรียบร้อยแล้ว`, active: activeVal });
    }

    // สร้างสินค้าพอยท์ช็อปตัวใหม่
    const { name, description, pointCost, imageUrl, rewardType, rewardData, stock, isActive } = body;

    if (!name || !pointCost || !rewardType) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 });
    }

    const { data: newItem, error: newItemErr } = await supabaseAdmin
      .from('point_items')
      .insert([{
        name,
        description,
        point_cost: Number(pointCost),
        image_url: imageUrl || null,
        reward_type: rewardType,
        reward_data: rewardData || {},
        stock: stock !== undefined ? Number(stock) : -1,
        is_active: isActive !== undefined ? isActive : true
      }])
      .select('*')
      .single();

    if (newItemErr) throw newItemErr;

    return NextResponse.json({ message: 'เพิ่มของรางวัลชิ้นใหม่สำเร็จ!', item: newItem });
  } catch (error) {
    console.error('Admin point-shop POST error:', error);
    return NextResponse.json({ error: error.message === 'Unauthorized' ? 'ไม่มีสิทธิ์เข้าถึง' : 'เกิดข้อผิดพลาดในระบบแอดมิน' }, { status: error.message === 'Unauthorized' ? 403 : 500 });
  }
}

export async function PUT(request) {
  try {
    await verifyAdmin();
    const { id, name, description, pointCost, imageUrl, rewardType, rewardData, stock, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ ID ของรางวัลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (pointCost !== undefined) updateData.point_cost = Number(pointCost);
    if (imageUrl !== undefined) updateData.image_url = imageUrl;
    if (rewardType !== undefined) updateData.reward_type = rewardType;
    if (rewardData !== undefined) updateData.reward_data = rewardData;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: updatedItem, error: updateErr } = await supabaseAdmin
      .from('point_items')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ message: 'แก้ไขของรางวัลสำเร็จ!', item: updatedItem });
  } catch (error) {
    console.error('Admin point-shop PUT error:', error);
    return NextResponse.json({ error: error.message === 'Unauthorized' ? 'ไม่มีสิทธิ์เข้าถึง' : 'เกิดข้อผิดพลาดในการแก้ไขของรางวัล' }, { status: error.message === 'Unauthorized' ? 403 : 500 });
  }
}

export async function DELETE(request) {
  try {
    await verifyAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ ID ที่ต้องการลบ' }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('point_items')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ message: 'ลบของรางวัลเรียบร้อยแล้ว!' });
  } catch (error) {
    console.error('Admin point-shop DELETE error:', error);
    return NextResponse.json({ error: error.message === 'Unauthorized' ? 'ไม่มีสิทธิ์เข้าถึง' : 'เกิดข้อผิดพลาดในการลบของรางวัล' }, { status: error.message === 'Unauthorized' ? 403 : 500 });
  }
}
