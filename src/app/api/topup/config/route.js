import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const defaultConfig = {
  promptpay: { enabled: true, promptpayId: '004999038911094', expectedName: 'สมัชญ์' },
  wallet: { enabled: true },
  cashcard: { enabled: true, feePercent: 15 },
  giftcode: { enabled: true }
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('value')
      .eq('key', 'topup_config')
      .maybeSingle();

    if (error) {
      console.error('Error fetching topup config:', error);
      return NextResponse.json(defaultConfig);
    }

    if (!data) {
      return NextResponse.json(defaultConfig);
    }

    return NextResponse.json(data.value);
  } catch (error) {
    console.error('Fetch topup config error:', error);
    return NextResponse.json(defaultConfig);
  }
}
