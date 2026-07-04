import { describe, expect, test } from 'vitest';
import { validatePrizeInput, validateTierInput } from './validation';

describe('validateTierInput', () => {
  test('normalizes a valid tier', () => {
    expect(validateTierInput({ name: '  Premium  ', price: '100' })).toEqual({
      ok: true,
      value: { name: 'Premium', price: 100 },
    });
  });

  test.each([
    [{ name: '', price: 100 }, 'ชื่อ'],
    [{ name: 'Premium', price: 0 }, 'ราคา'],
    [{ name: 'Premium', price: -1 }, 'ราคา'],
    [{ name: 'Premium', price: 'abc' }, 'ราคา'],
  ])('rejects invalid tier %#', (input, message) => {
    const result = validateTierInput(input);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(message);
  });
});

describe('validatePrizeInput', () => {
  test.each([0, 12.5, 100])('accepts chance %s', chance => {
    expect(validatePrizeInput({
      tierId: 'tier-1',
      name: 'รางวัล',
      type: 'empty',
      chance,
    }).ok).toBe(true);
  });

  test.each([-0.01, 100.01, 'abc'])('rejects invalid chance %s', chance => {
    const result = validatePrizeInput({
      tierId: 'tier-1',
      name: 'รางวัล',
      type: 'empty',
      chance,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('เปอร์เซ็นต์');
  });

  test('requires a tier and a supported prize type', () => {
    expect(validatePrizeInput({ name: 'รางวัล', type: 'empty', chance: 10 }).ok).toBe(false);
    expect(validatePrizeInput({ tierId: 'tier-1', name: 'รางวัล', type: 'cash', chance: 10 }).ok).toBe(false);
  });

  test('requires a positive coupon discount', () => {
    const result = validatePrizeInput({
      tierId: 'tier-1',
      name: 'คูปอง',
      type: 'coupon',
      chance: 10,
      couponDiscount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ส่วนลด');
  });

  test('normalizes and deduplicates code stock', () => {
    const result = validatePrizeInput({
      tierId: 'tier-1',
      name: '  Game key ',
      type: 'code',
      chance: '12.345',
      stockInput: 'ABC\n\nDEF\nABC ',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        tierId: 'tier-1',
        name: 'Game key',
        type: 'code',
        chance: 12.35,
        couponDiscount: 0,
        topupAmount: 0,
        stock: ['ABC', 'DEF'],
      },
    });
  });

  test('requires a positive topup amount', () => {
    const result = validatePrizeInput({
      tierId: 'tier-1',
      name: 'เครดิตเว็บ',
      type: 'topup',
      chance: 10,
      topupAmount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ยอดเงินเติมเข้าเว็บ');
  });

  test('normalizes a valid topup prize', () => {
    const result = validatePrizeInput({
      tierId: 'tier-1',
      name: 'เครดิตฟรี 100 บาท',
      type: 'topup',
      chance: '5.5',
      topupAmount: '100',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        tierId: 'tier-1',
        name: 'เครดิตฟรี 100 บาท',
        type: 'topup',
        chance: 5.5,
        couponDiscount: 0,
        topupAmount: 100,
        stock: [],
      },
    });
  });
});

