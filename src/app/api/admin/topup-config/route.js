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

const defaultConfig = {
  promptpay: { enabled: true, promptpayId: '004999038911094', expectedName: 'สมัชญ์' },
  wallet: { enabled: true },
  cashcard: { enabled: true, feePercent: 15 },
  giftcode: { enabled: true }
};

export async function GET() {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('value')
      .eq('key', 'topup_config')
      .maybeSingle();

    if (error) {
      console.warn('Failed to query site_settings, using defaultConfig:', error.message);
      return NextResponse.json(defaultConfig);
    }

    if (!data) {
      return NextResponse.json(defaultConfig);
    }

    return NextResponse.json(data.value);
  } catch (error) {
    console.error('Admin get topup config error:', error);
    return NextResponse.json(defaultConfig);
  }
}

export async function POST(request) {
  try {
    if (!await checkAdmin()) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    const newConfig = await request.json();

    if (!newConfig || typeof newConfig !== 'object') {
      return NextResponse.json({ error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({
        key: 'topup_config',
        value: newConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ message: 'บันทึกการตั้งค่าระบบเติมเงินสำเร็จแล้ว' });
  } catch (error) {
    console.error('Admin post topup config error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการตั้งค่า' }, { status: 500 });
  }
}
