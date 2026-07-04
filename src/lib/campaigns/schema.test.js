import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8');

describe('campaign schema', () => {
  for (const name of ['campaigns', 'campaign_recipients', 'customer_notifications', 'campaign_events', 'user_marketing_preferences', 'campaign_audit_logs']) {
    test(`defines ${name}`, () => expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name}`)));
  }
  test('defines approval and claiming RPCs', () => {
    expect(sql).toContain('approve_campaign');
    expect(sql).toContain('claim_due_campaigns');
  });
  test('defines recipient and event idempotency', () => {
    expect(sql).toContain('UNIQUE (campaign_id, user_id, channel)');
    expect(sql).toContain('UNIQUE (campaign_id, recipient_id, event_type, transaction_id)');
  });
  test('locks down campaign tables and RPC execution', () => {
    expect(sql).toContain('ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.approve_campaign(UUID, UUID) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_due_campaigns(INTEGER) TO service_role');
  });
  test('links coupons and enforces preference and frequency rules', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS campaign_id UUID');
    expect(sql).toContain('in_app_marketing');
    expect(sql).toContain('7 days');
  });
});


