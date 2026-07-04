import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { POST } from './route';

const request = body => new Request('http://localhost/api/gacha/spin', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('public gacha spin route', () => {
  beforeEach(() => vi.clearAllMocks());

  test('requires login and tier id', async () => {
    mocks.getServerSession.mockResolvedValue(null);
    expect((await POST(request({ tierId: 'tier-1' }))).status).toBe(401);

    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    expect((await POST(request({}))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test('delegates all paid mutations to the atomic RPC', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.rpc.mockResolvedValue({
      data: {
        itemId: 'prize-1', prizeName: 'Voucher', type: 'coupon', wonValue: 'GACHA-123',
        tierId: 'tier-1', tierName: 'Premium', chargedPrice: 100, newBalance: 250,
        transactionId: 'tx-1',
      },
      error: null,
    });

    const response = await POST(request({ tierId: 'tier-1', price: 1 }));
    const payload = await response.json();

    expect(mocks.rpc).toHaveBeenCalledWith('spin_gacha', {
      p_user_id: 'user-1',
      p_tier_id: 'tier-1',
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(payload.chargedPrice).toBe(100);
  });
});
