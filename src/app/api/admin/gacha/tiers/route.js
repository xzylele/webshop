import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { supabaseAdmin } from '@/lib/supabase';
import { getTierReadiness } from '@/lib/gacha/rules';
import { validateTierInput } from '@/lib/gacha/validation';

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'admin';
}

function slugify(name) {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9เธ-เน]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `gacha-${Date.now()}`;
}

function formatTier(tier, items = []) {
  const formattedItems = items.map(item => ({
    ...item,
    chance: Number(item.chance),
    stock: item.stock || [],
  }));
  const readiness = getTierReadiness({
    isActive: tier.is_active,
    price: Number(tier.price),
  }, formattedItems);

  return {
    id: tier.id,
    _id: tier.id,
    name: tier.name,
    slug: tier.slug,
    price: Number(tier.price),
    isActive: tier.is_active,
    sortOrder: tier.sort_order,
    createdAt: tier.created_at,
    ...readiness,
  };
}

export async function GET() {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'เนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธเนเธญเธกเธนเธฅเธเธตเน' }, { status: 403 });

    const [{ data: tiers, error: tierError }, { data: items, error: itemError }] = await Promise.all([
      supabaseAdmin.from('gacha_tiers').select('*').order('sort_order').order('created_at'),
      supabaseAdmin.from('gacha_items').select('tier_id, type, chance, stock'),
    ]);
    if (tierError) throw tierError;
    if (itemError) throw itemError;

    return NextResponse.json((tiers || []).map(tier => formatTier(
      tier,
      (items || []).filter(item => item.tier_id === tier.id),
    )));
  } catch (error) {
    console.error('Admin fetch gacha tiers error:', error);
    return NextResponse.json({ error: 'เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเนเธซเธฅเธ”เธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'เนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธเนเธญเธกเธนเธฅเธเธตเน' }, { status: 403 });
    const body = await request.json();
    const validation = validateTierInput(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('gacha_tiers')
      .insert([{
        ...validation.value,
        slug: slugify(validation.value.name),
        is_active: body.isActive ?? true,
        sort_order: Number(body.sortOrder) || 0,
      }])
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'เธเธทเนเธญเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒเธเธตเนเธกเธตเธญเธขเธนเนเนเธฅเนเธง' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ message: 'เธชเธฃเนเธฒเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒเธชเธณเน€เธฃเนเธ', tier: formatTier(data) }, { status: 201 });
  } catch (error) {
    console.error('Admin create gacha tier error:', error);
    return NextResponse.json({ error: 'เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเธชเธฃเนเธฒเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'เนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธเนเธญเธกเธนเธฅเธเธตเน' }, { status: 403 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'เนเธกเนเธเธเนเธญเธ”เธตเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 400 });

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('gacha_tiers').select('*').eq('id', body.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: 'เนเธกเนเธเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 404 });

    const validation = validateTierInput({
      name: body.name ?? existing.name,
      price: body.price ?? existing.price,
    });
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    const updates = {
      ...validation.value,
      is_active: body.isActive ?? existing.is_active,
      sort_order: body.sortOrder === undefined ? existing.sort_order : Number(body.sortOrder),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin
      .from('gacha_tiers').update(updates).eq('id', body.id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ message: 'เธญเธฑเธเน€เธ”เธ•เธฃเธฐเธ”เธฑเธเธเธฒเธเธฒเธชเธณเน€เธฃเนเธ', tier: formatTier(data) });
  } catch (error) {
    console.error('Admin update gacha tier error:', error);
    return NextResponse.json({ error: 'เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเธญเธฑเธเน€เธ”เธ•เธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'เนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธเนเธญเธกเธนเธฅเธเธตเน' }, { status: 403 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'เนเธกเนเธเธเนเธญเธ”เธตเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 400 });

    const { count, error: countError } = await supabaseAdmin
      .from('gacha_items').select('id', { count: 'exact', head: true }).eq('tier_id', id);
    if (countError) throw countError;
    if (count > 0) return NextResponse.json({ error: 'เธ•เนเธญเธเธขเนเธฒเธขเธซเธฃเธทเธญเธฅเธเธฃเธฒเธเธงเธฑเธฅเนเธเธฃเธฐเธ”เธฑเธเธเธตเนเธเนเธญเธ' }, { status: 409 });

    const { data, error } = await supabaseAdmin
      .from('gacha_tiers').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'เนเธกเนเธเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 404 });
    return NextResponse.json({ message: 'เธฅเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒเธชเธณเน€เธฃเนเธ' });
  } catch (error) {
    console.error('Admin delete gacha tier error:', error);
    return NextResponse.json({ error: 'เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเธฅเธเธฃเธฐเธ”เธฑเธเธเธฒเธเธฒ' }, { status: 500 });
  }
}
