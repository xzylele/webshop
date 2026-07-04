import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/app/api/seed/route.js'), 'utf8');

describe('gacha seed contract', () => {
  test('seeds the three default tiers and links prizes', () => {
    expect(source).toContain("slug: 'normal'");
    expect(source).toContain("slug: 'premium'");
    expect(source).toContain("slug: 'luxury'");
    expect(source).toContain('tier_id:');
  });

  test('uses the agreed default tier prices', () => {
    expect(source).toContain("price: 30");
    expect(source).toContain("price: 100");
    expect(source).toContain("price: 300");
  });
});
