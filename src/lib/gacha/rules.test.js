import { describe, expect, test } from 'vitest';
import { getTierReadiness, selectPrizeByPercent, sumPercentages } from './rules';

const tier = { isActive: true, price: 30 };

describe('gacha rules', () => {
  test('sums percentages at two-decimal precision', () => {
    expect(sumPercentages([
      { chance: 33.33 },
      { chance: 33.33 },
      { chance: 33.34 },
    ])).toBe(100);
  });

  test('blocks a disabled tier', () => {
    expect(getTierReadiness({ ...tier, isActive: false }, [
      { type: 'empty', chance: 100 },
    ])).toEqual({
      isReady: false,
      reason: 'ระดับนี้ปิดใช้งาน',
      totalPercentage: 100,
    });
  });

  test('blocks a tier whose percentages do not total 100', () => {
    expect(getTierReadiness(tier, [{ type: 'empty', chance: 99 }])).toEqual({
      isReady: false,
      reason: 'เปอร์เซ็นต์รางวัลต้องรวมครบ 100%',
      totalPercentage: 99,
    });
  });

  test('blocks a tier when a positive-percent code prize is empty', () => {
    const result = getTierReadiness(tier, [
      { type: 'code', chance: 10, stock: [] },
      { type: 'empty', chance: 90, stock: [] },
    ]);

    expect(result.isReady).toBe(false);
    expect(result.reason).toContain('สต็อก');
  });

  test('ignores stock for a zero-percent code prize', () => {
    expect(getTierReadiness(tier, [
      { type: 'code', chance: 0, stock: [] },
      { type: 'empty', chance: 100, stock: [] },
    ]).isReady).toBe(true);
  });

  test('selects exact cumulative percentage boundaries', () => {
    const prizes = [{ id: 'a', chance: 25 }, { id: 'b', chance: 75 }];

    expect(selectPrizeByPercent(prizes, 0).id).toBe('a');
    expect(selectPrizeByPercent(prizes, 24.999).id).toBe('a');
    expect(selectPrizeByPercent(prizes, 25).id).toBe('b');
    expect(selectPrizeByPercent(prizes, 99.999).id).toBe('b');
  });
});
