import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn(), from: vi.fn() }));
vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { POST } from './route';

const request = body => new Request('http://localhost/api/admin/gacha', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('admin gacha prize route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  test('requires a tier for every prize', async () => {
    const response = await POST(request({ name: 'Salt', type: 'empty', chance: 100 }));
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  test('persists exact zero percent and tier id', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'prize-1', tier_id: 'tier-1', name: 'Backup', type: 'empty', chance: '0', coupon_discount: 0, stock: [] },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ insert });

    const response = await POST(request({ tierId: 'tier-1', name: 'Backup', type: 'empty', chance: 0 }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ tier_id: 'tier-1', chance: 0 })]);
    expect(payload.gachaItem.tierId).toBe('tier-1');
    expect(payload.gachaItem.chance).toBe(0);
  });
});
