import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8');
const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260704_multi_tier_gacha.sql');

describe('multi-tier gacha database schema', () => {
  test('defines tiers in the fresh schema', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS public.gacha_tiers');
    expect(schema).toContain('price NUMERIC(12,2)');
    expect(schema).toContain('slug TEXT UNIQUE NOT NULL');
    expect(schema).toContain('tier_id UUID NOT NULL REFERENCES public.gacha_tiers');
  });

  test('ships an upgrade migration with backfill', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS tier_id UUID');
    expect(migration).toContain("WHERE slug = 'normal'");
    expect(migration).toContain('ALTER COLUMN tier_id SET NOT NULL');
  });

  test('enforces price and percentage ranges', () => {
    expect(schema).toContain('CHECK (price > 0)');
    expect(schema).toContain('CHECK (chance >= 0 AND chance <= 100)');
  });

  test('defines an atomic security-definer spin RPC', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.spin_gacha');
    expect(schema).toContain('SECURITY DEFINER');
    expect(schema).toContain('FOR UPDATE');
    expect(schema).toContain('REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM PUBLIC');
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) TO service_role');
  });

  test('records tier snapshots in public winner logs', () => {
    expect(schema).toContain('tier_id UUID REFERENCES public.gacha_tiers');
    expect(schema).toContain('tier_name TEXT');
    expect(schema).toContain('tier_price NUMERIC(12,2)');
  });

  test('defines topup code gacha prize schema', () => {
    expect(schema).toContain('topup_amount NUMERIC DEFAULT 0');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS public.topup_codes');
    expect(schema).toContain('code TEXT UNIQUE NOT NULL');
  });
});

