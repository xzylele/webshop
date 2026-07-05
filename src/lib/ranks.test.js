import { describe, it, expect } from 'vitest';
import { getUserRank } from './ranks';

describe('VIP Ranks System', () => {
  it('should return Member for 0 spent', () => {
    const rank = getUserRank(0);
    expect(rank.name).toBe('Member');
    expect(rank.discountPercent).toBe(0);
  });

  it('should return Bronze VIP for 1500 spent', () => {
    const rank = getUserRank(1500);
    expect(rank.name).toBe('Bronze VIP');
    expect(rank.discountPercent).toBe(1.5);
  });

  it('should return Silver VIP for 5000 spent', () => {
    const rank = getUserRank(5000);
    expect(rank.name).toBe('Silver VIP');
    expect(rank.discountPercent).toBe(3.0);
  });

  it('should return Gold VIP for 16000 spent', () => {
    const rank = getUserRank(16000);
    expect(rank.name).toBe('Gold VIP');
    expect(rank.discountPercent).toBe(5.0);
  });

  it('should return Platinum VIP for 75000 spent', () => {
    const rank = getUserRank(75000);
    expect(rank.name).toBe('Platinum VIP');
    expect(rank.discountPercent).toBe(7.5);
  });
});
