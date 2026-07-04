const toBasisPoints = value => Math.round(Number(value || 0) * 100);

export function sumPercentages(items) {
  return items.reduce((sum, item) => sum + toBasisPoints(item.chance), 0) / 100;
}

export function getTierReadiness(tier, items) {
  const totalPercentage = sumPercentages(items);

  if (!tier?.isActive) {
    return { isReady: false, reason: 'ระดับนี้ปิดใช้งาน', totalPercentage };
  }
  if (!(Number(tier.price) > 0)) {
    return { isReady: false, reason: 'ราคาสุ่มไม่ถูกต้อง', totalPercentage };
  }
  if (!items.length) {
    return { isReady: false, reason: 'ยังไม่มีรางวัลในระดับนี้', totalPercentage };
  }
  if (totalPercentage !== 100) {
    return { isReady: false, reason: 'เปอร์เซ็นต์รางวัลต้องรวมครบ 100%', totalPercentage };
  }
  if (items.some(item => (
    item.type === 'code'
    && Number(item.chance) > 0
    && !item.stock?.length
  ))) {
    return { isReady: false, reason: 'รางวัลโค้ดมีสต็อกไม่เพียงพอ', totalPercentage };
  }

  return { isReady: true, reason: null, totalPercentage };
}

export function selectPrizeByPercent(items, randomPercent) {
  let cursor = Number(randomPercent);

  for (const item of items) {
    cursor -= Number(item.chance);
    if (cursor < 0) return item;
  }

  return null;
}
