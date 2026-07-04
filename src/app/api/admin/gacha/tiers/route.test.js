import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  from: vi.fn(),
}));

vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('../../../auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { POST } from './route';

const request = body => new Request('http://localhost/api/admin/gacha/tiers', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('admin gacha tier route', () => {
  beforeEach(() => vi.clearAllMocks());

  test('rejects a non-admin', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { role: 'user' } });
    const response = await POST(request({ name: 'Premium', price: 100 }));
    expect(response.status).toBe(403);
  });

  test('rejects an invalid price before querying the database', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { role: 'admin' } });
    const response = await POST(request({ name: 'Premium', price: 0 }));
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  test('creates a tier with a stable slug and numeric price', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { role: 'admin' } });
    const single = vi.fn().mockResolvedValue({
      data: { id: 'tier-1', name: 'Premium Plus', slug: 'premium-plus', price: '120', is_active: true, sort_order: 40 },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ insert });

    const response = await POST(request({ name: 'Premium Plus', price: 120 }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ slug: 'premium-plus', price: 120 })]);
    expect(data.tier.price).toBe(120);
  });
});
