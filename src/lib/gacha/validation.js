const PRIZE_TYPES = new Set(['empty', 'coupon', 'code', 'topup']);

const failure = error => ({ ok: false, error });

export function parseStockInput(stockInput) {
  if (Array.isArray(stockInput)) {
    return [...new Set(stockInput.map(code => String(code).trim()).filter(Boolean))];
  }

  return [...new Set(
    String(stockInput || '')
      .split(/\r?\n/)
      .map(code => code.trim())
      .filter(Boolean),
  )];
}

export function validateTierInput(input) {
  const name = String(input?.name || '').trim();
  const price = Number(input?.price);

  if (!name) return failure('กรุณากรอกชื่อระดับกาชา');
  if (!Number.isFinite(price) || price <= 0) return failure('ราคาสุ่มต้องมากกว่า 0');

  return { ok: true, value: { name, price } };
}

export function validatePrizeInput(input) {
  const tierId = String(input?.tierId || '').trim();
  const name = String(input?.name || '').trim();
  const type = String(input?.type || '').trim();
  const chanceNumber = Number(input?.chance);
  const couponDiscount = type === 'coupon' ? Number(input?.couponDiscount) : 0;
  const topupAmount = type === 'topup' ? Number(input?.topupAmount) : 0;

  if (!tierId) return failure('กรุณาเลือกระดับกาชา');
  if (!name) return failure('กรุณากรอกชื่อรางวัล');
  if (!PRIZE_TYPES.has(type)) return failure('ประเภทรางวัลไม่ถูกต้อง');
  if (!Number.isFinite(chanceNumber) || chanceNumber < 0 || chanceNumber > 100) {
    return failure('เปอร์เซ็นต์รางวัลต้องอยู่ระหว่าง 0 ถึง 100');
  }
  if (type === 'coupon' && (!Number.isFinite(couponDiscount) || couponDiscount <= 0)) {
    return failure('มูลค่าส่วนลดต้องมากกว่า 0');
  }
  if (type === 'topup' && (!Number.isFinite(topupAmount) || topupAmount <= 0)) {
    return failure('ยอดเงินเติมเข้าเว็บต้องมากกว่า 0');
  }

  return {
    ok: true,
    value: {
      tierId,
      name,
      type,
      chance: Math.round(chanceNumber * 100) / 100,
      couponDiscount,
      topupAmount,
      stock: type === 'code' ? parseStockInput(input.stockInput ?? input.stock) : [],
    },
  };
}
