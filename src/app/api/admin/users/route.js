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

export async function GET(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('users').select('*');
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error: usersErr } = await query.order('created_at', { ascending: false });

    if (usersErr) throw usersErr;

    const formattedUsers = users.map(u => ({
      ...u,
      _id: u.id,
      createdAt: u.created_at,
      totalSpent: Number(u.total_spent),
      balance: Number(u.balance)
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Admin fetch users error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const data = await request.json();
    const { userId, role, balanceAdjustment, reason, newTotalSpent } = data;

    if (!userId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีผู้ใช้' }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
    }

    let updated = false;
    let updates = {};

    // 1. ปรับยอดเงิน Wallet
    if (balanceAdjustment !== undefined && Number(balanceAdjustment) !== 0) {
      if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลในการปรับยอดเงิน' }, { status: 400 });
      }

      const adjAmount = Number(balanceAdjustment);
      updates.balance = Number(user.balance) + adjAmount;
      updated = true;

      const { error: txErr } = await supabaseAdmin.from('transactions').insert([
        {
          user_id: user.id,
          type: adjAmount > 0 ? 'topup' : 'purchase',
          amount: adjAmount,
          description: `[ปรับยอดเงินโดยแอดมิน] ${reason}`,
          status: 'completed'
        }
      ]);
      
      if (txErr) throw txErr;
    }

    // 2. ปรับเปลี่ยนสิทธิ์ (Role)
    if (role !== undefined) {
      updates.role = role;
      updated = true;
    }

    // 3. ปรับเปลี่ยนยอดใช้จ่ายสะสม (totalSpent) สำหรับคำนวณ Rank ยศสมาชิก
    if (newTotalSpent !== undefined) {
      updates.total_spent = Math.max(0, Number(newTotalSpent));
      updated = true;
    }

    if (!updated) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    const formattedUser = {
      ...updatedUser,
      _id: updatedUser.id,
      createdAt: updatedUser.created_at,
      totalSpent: Number(updatedUser.total_spent),
      balance: Number(updatedUser.balance)
    };

    return NextResponse.json({
      message: 'บันทึกข้อมูลผู้ใช้งานสำเร็จแล้ว',
      user: formattedUser
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ใช้งาน' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'กรุณาระบุไอดีผู้ใช้ที่ต้องการลบ' }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ในระบบ' }, { status: 404 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ message: 'ลบผู้ใช้และล้างประวัติการทำรายการเรียบร้อย!' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน' }, { status: 500 });
  }
}

