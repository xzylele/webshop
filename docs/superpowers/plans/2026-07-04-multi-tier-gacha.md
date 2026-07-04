# Multi-Tier Gacha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single fixed-price gacha with administrator-defined tiers, exact 100% prize pools, stock-aware availability, and atomic paid spins.

**Architecture:** Add `gacha_tiers` and tier references in PostgreSQL, with a security-definer RPC owning the atomic spin transaction. Keep probability/readiness rules in small JavaScript helpers for API/UI consistency and fast unit tests, while PostgreSQL independently enforces the critical transaction rules. Split tier administration and prize administration APIs, then adapt the existing customer and admin pages to consume tier-shaped responses.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, TanStack Query, Supabase/PostgreSQL, Vitest, Testing Library, Tailwind CSS.

---

## File Structure

- Create `src/lib/gacha/rules.js`: pure percentage, readiness, and random-boundary rules.
- Create `src/lib/gacha/rules.test.js`: unit tests for all pure rules.
- Create `src/lib/gacha/validation.js`: tier and prize administrator payload validation.
- Create `src/lib/gacha/validation.test.js`: validation tests.
- Create `supabase/migrations/20260704_multi_tier_gacha.sql`: upgrade existing deployments and define atomic RPC.
- Modify `schema.sql`: keep fresh-database schema equivalent to the migration result.
- Create `src/lib/gacha/schema.test.js`: SQL structure and security assertions.
- Create `src/app/api/admin/gacha/tiers/route.js`: tier CRUD.
- Create `src/app/api/admin/gacha/tiers/route.test.js`: tier route behavior.
- Modify `src/app/api/admin/gacha/route.js`: tier-filtered prize CRUD and movement.
- Create `src/app/api/admin/gacha/route.test.js`: prize route behavior.
- Modify `src/app/api/gacha/spin/route.js`: tier catalog GET and RPC-backed POST.
- Create `src/app/api/gacha/spin/route.test.js`: public route behavior.
- Create `src/app/components/GachaTierSelector.js`: customer tier cards.
- Create `src/app/components/GachaTierSelector.test.jsx`: selector states and callbacks.
- Modify `src/app/gacha/page.js`: selected tier, dynamic wheel, price, and POST body.
- Create `src/app/components/AdminGachaTierManager.js`: tier CRUD interface.
- Create `src/app/components/AdminGachaTierManager.test.jsx`: tier form and readiness display tests.
- Modify `src/app/admin/page.js`: compose tier manager and tier-scoped prize editor.
- Modify `src/app/components/AdminGachaStockModal.js`: preserve tier-scoped invalidation.
- Modify `src/app/api/seed/route.js`: seed three tiers and tier-linked prizes.

### Task 1: Pure Gacha Probability and Readiness Rules

**Files:**
- Create: `src/lib/gacha/rules.test.js`
- Create: `src/lib/gacha/rules.js`

- [ ] **Step 1: Write failing tests for percentage totals and readiness**

```js
import { describe, expect, test } from 'vitest';
import { getTierReadiness, selectPrizeByPercent, sumPercentages } from './rules';

const tier = { isActive: true, price: 30 };

describe('gacha rules', () => {
  test('sums percentages at two-decimal precision', () => {
    expect(sumPercentages([{ chance: 33.33 }, { chance: 33.33 }, { chance: 33.34 }])).toBe(100);
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

  test('selects exact cumulative percentage boundaries', () => {
    const prizes = [{ id: 'a', chance: 25 }, { id: 'b', chance: 75 }];
    expect(selectPrizeByPercent(prizes, 0).id).toBe('a');
    expect(selectPrizeByPercent(prizes, 24.999).id).toBe('a');
    expect(selectPrizeByPercent(prizes, 25).id).toBe('b');
    expect(selectPrizeByPercent(prizes, 99.999).id).toBe('b');
  });
});
```

- [ ] **Step 2: Run tests and verify the missing-module failure**

Run: `npm test -- src/lib/gacha/rules.test.js --run`
Expected: FAIL because `./rules` does not exist.

- [ ] **Step 3: Implement the minimal pure rules**

```js
const toBasisPoints = value => Math.round(Number(value || 0) * 100);

export function sumPercentages(items) {
  return items.reduce((sum, item) => sum + toBasisPoints(item.chance), 0) / 100;
}

export function getTierReadiness(tier, items) {
  const totalPercentage = sumPercentages(items);
  if (!tier?.isActive) return { isReady: false, reason: 'ระดับนี้ปิดใช้งาน', totalPercentage };
  if (!(Number(tier.price) > 0)) return { isReady: false, reason: 'ราคาสุ่มไม่ถูกต้อง', totalPercentage };
  if (!items.length) return { isReady: false, reason: 'ยังไม่มีรางวัลในระดับนี้', totalPercentage };
  if (totalPercentage !== 100) return { isReady: false, reason: 'เปอร์เซ็นต์รางวัลต้องรวมครบ 100%', totalPercentage };
  if (items.some(item => item.type === 'code' && Number(item.chance) > 0 && !item.stock?.length)) {
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
```

- [ ] **Step 4: Run the focused test and full suite**

Run: `npm test -- src/lib/gacha/rules.test.js --run && npm run test:run`
Expected: PASS with no failed tests.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/gacha/rules.js src/lib/gacha/rules.test.js
git commit -m "feat: add exact gacha probability rules"
```

### Task 2: Administrator Payload Validation

**Files:**
- Create: `src/lib/gacha/validation.test.js`
- Create: `src/lib/gacha/validation.js`

- [ ] **Step 1: Write failing table-driven validation tests**

Test valid tier `{ name: 'Premium', price: 100 }`, reject blank names and non-positive prices, accept prize chances `0`, `12.5`, and `100`, reject values below 0 or above 100, require positive coupon discounts, and require a tier ID for every prize.

```js
expect(validateTierInput({ name: 'Premium', price: 100 })).toEqual({ ok: true, value: { name: 'Premium', price: 100 } });
expect(validateTierInput({ name: '', price: 100 }).error).toContain('ชื่อ');
expect(validatePrizeInput({ tierId: 'tier-1', name: 'Salt', type: 'empty', chance: 0 }).ok).toBe(true);
expect(validatePrizeInput({ tierId: 'tier-1', name: 'Bad', type: 'empty', chance: 100.01 }).ok).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/gacha/validation.test.js --run`
Expected: FAIL because validation exports are missing.

- [ ] **Step 3: Implement normalized validators**

Return `{ ok: true, value }` or `{ ok: false, error }`; trim names, convert numeric strings once, whitelist `empty|coupon|code`, round percentages to two decimals, parse newline stock into unique non-empty strings, and never apply fallback defaults to invalid values.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/gacha/validation.test.js --run && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/gacha/validation.js src/lib/gacha/validation.test.js
git commit -m "feat: validate gacha tier and prize inputs"
```

### Task 3: PostgreSQL Tier Schema and Atomic Spin RPC

**Files:**
- Create: `src/lib/gacha/schema.test.js`
- Create: `supabase/migrations/20260704_multi_tier_gacha.sql`
- Modify: `schema.sql`

- [ ] **Step 1: Write failing SQL contract tests**

Read both SQL files and assert they define `public.gacha_tiers`, `gacha_items.tier_id`, tier fields in `gacha_logs`, checks for positive price and `chance BETWEEN 0 AND 100`, indexes, `spin_gacha`, `SECURITY DEFINER`, row locks, execution revocation from public/anonymous users, and grant only to `service_role`.

```js
expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.gacha_tiers');
expect(sql).toContain('ADD COLUMN IF NOT EXISTS tier_id UUID');
expect(sql).toContain('CREATE OR REPLACE FUNCTION public.spin_gacha');
expect(sql).toContain('FOR UPDATE');
expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.spin_gacha');
expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.spin_gacha');
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/gacha/schema.test.js --run`
Expected: FAIL because the migration and schema additions are absent.

- [ ] **Step 3: Write the idempotent migration**

Create the tier table, insert Normal/Premium/Luxury with stable slugs, add nullable tier references, backfill existing items to Normal, then enforce `NOT NULL`. Add tier snapshots to logs. Use numeric checks and indexes. The RPC accepts `p_user_id UUID` and `p_tier_id UUID`, locks the user/tier/eligible code row, validates a 10,000-basis-point total, selects with PostgreSQL `random()`, deducts the database price, creates coupon/code/transaction/log records, and returns one JSON object. Raise distinct SQLSTATE/message pairs for disabled tier, invalid pool, stock depletion, and insufficient balance.

- [ ] **Step 4: Mirror the final schema in `schema.sql`**

Ensure fresh installs create the same tables, constraints, function, revocations, grants, and initial tiers without requiring the upgrade migration.

- [ ] **Step 5: Verify SQL contracts and regressions**

Run: `npm test -- src/lib/gacha/schema.test.js src/lib/campaigns/schema.test.js --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add schema.sql supabase/migrations/20260704_multi_tier_gacha.sql src/lib/gacha/schema.test.js
git commit -m "feat: add multi-tier gacha database schema"
```

### Task 4: Tier Administration API

**Files:**
- Create: `src/app/api/admin/gacha/tiers/route.test.js`
- Create: `src/app/api/admin/gacha/tiers/route.js`

- [ ] **Step 1: Write failing route tests**

Mock only authentication and Supabase boundaries. Test 403 for non-admins; GET formats numeric price and readiness for each tier; POST rejects bad prices and creates a slug; PUT updates name, price, active state, and order; DELETE returns 409 when prizes exist and deletes an empty tier.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/admin/gacha/tiers/route.test.js --run`
Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement route handlers following Next.js 16 route-handler docs**

Use async `GET`, `POST`, `PUT`, and `DELETE`, `NextResponse.json`, existing `getServerSession(authOptions)`, validators from Task 2, and `getTierReadiness` from Task 1. Generate collision-safe slugs server-side and return Thai errors.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `npm test -- src/app/api/admin/gacha/tiers/route.test.js --run && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/admin/gacha/tiers/route.js src/app/api/admin/gacha/tiers/route.test.js
git commit -m "feat: add gacha tier administration API"
```

### Task 5: Tier-Scoped Prize Administration API

**Files:**
- Create: `src/app/api/admin/gacha/route.test.js`
- Modify: `src/app/api/admin/gacha/route.js`

- [ ] **Step 1: Write failing API tests**

Cover GET grouping/filtering by `tierId`, POST requiring a valid tier, exact percentage persistence (including zero), PUT moving an item to another tier and editing stock, DELETE existing behavior, and 400 responses for invalid type/chance/coupon data. Assert returned items expose `tierId` and raw exact `chance`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/admin/gacha/route.test.js --run`
Expected: FAIL because tier fields and validation are missing.

- [ ] **Step 3: Refactor the route minimally**

Remove `Number(chance) || 10`, use Task 2 validators, read/write `tier_id`, support `tierId` query filtering, allow `tierId` in PUT, retain used-code formatting, and invalidate neither probabilities nor stock silently.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/app/api/admin/gacha/route.test.js --run && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/admin/gacha/route.js src/app/api/admin/gacha/route.test.js
git commit -m "feat: scope gacha prizes to tiers"
```

### Task 6: Public Tier Catalog and Atomic Spin API

**Files:**
- Create: `src/app/api/gacha/spin/route.test.js`
- Modify: `src/app/api/gacha/spin/route.js`

- [ ] **Step 1: Write failing public route tests**

GET should return `{ tiers, logs }`, with each tier containing sorted items and readiness. POST should require authentication and `{ tierId }`, call `supabaseAdmin.rpc('spin_gacha', { p_user_id, p_tier_id })`, never accept a price from the client, map known RPC errors to 400/409, and format the RPC result.

```js
expect(rpc).toHaveBeenCalledWith('spin_gacha', {
  p_user_id: 'user-1',
  p_tier_id: 'tier-premium',
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/gacha/spin/route.test.js --run`
Expected: FAIL because the current POST ignores request data and performs non-atomic work in JavaScript.

- [ ] **Step 3: Implement the catalog and RPC adapter**

GET queries tiers, items, and logs, groups items by tier, and computes readiness. POST parses the JSON body, validates the tier ID, calls only the atomic RPC for business mutations, and maps the returned JSON to `itemId`, `prizeName`, `type`, `wonValue`, `tier`, `chargedPrice`, `newBalance`, and `transactionId`.

- [ ] **Step 4: Verify GREEN and all API tests**

Run: `npm test -- src/app/api/gacha/spin/route.test.js src/app/api/admin/gacha/route.test.js src/app/api/admin/gacha/tiers/route.test.js --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/gacha/spin/route.js src/app/api/gacha/spin/route.test.js
git commit -m "feat: spin selected gacha tier atomically"
```

### Task 7: Customer Tier Selector and Dynamic Gacha Page

**Files:**
- Create: `src/app/components/GachaTierSelector.test.jsx`
- Create: `src/app/components/GachaTierSelector.js`
- Modify: `src/app/gacha/page.js`

- [ ] **Step 1: Write failing selector tests**

Render three tiers and assert names/prices, selected styling semantics (`aria-pressed`), disabled reason text, and callback execution for an inspectable unavailable tier.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/components/GachaTierSelector.test.jsx --run`
Expected: FAIL because the component is absent.

- [ ] **Step 3: Implement `GachaTierSelector`**

Build accessible buttons/cards that show Thai status labels, formatted THB prices, and do not prevent selecting an unavailable tier for inspection.

- [ ] **Step 4: Verify selector GREEN**

Run: `npm test -- src/app/components/GachaTierSelector.test.jsx --run`
Expected: PASS.

- [ ] **Step 5: Integrate selected tier into the page**

Derive the initial tier as first ready active tier or first visible tier, reset selected prize results on tier change, source `prizes` from `selectedTier.items`, display exact `%`, compare balance to `selectedTier.price`, disable spin with `selectedTier.reason`, and POST JSON `{ tierId: selectedTier.id }`. Keep wheel animation keyed to the selected tier's items.

- [ ] **Step 6: Run component tests, lint the touched files, and build**

Run: `npm test -- src/app/components/GachaTierSelector.test.jsx --run && npm run lint -- src/app/gacha/page.js src/app/components/GachaTierSelector.js && npm run build`
Expected: PASS and build exit code 0.

- [ ] **Step 7: Commit**

```powershell
git add src/app/gacha/page.js src/app/components/GachaTierSelector.js src/app/components/GachaTierSelector.test.jsx
git commit -m "feat: let customers choose a gacha tier"
```

### Task 8: Administrator Tier and Prize Interface

**Files:**
- Create: `src/app/components/AdminGachaTierManager.test.jsx`
- Create: `src/app/components/AdminGachaTierManager.js`
- Modify: `src/app/admin/page.js`
- Modify: `src/app/components/AdminGachaStockModal.js`

- [ ] **Step 1: Write failing tier manager tests**

Test rendering totals such as `85/100%`, missing/exceeded messages, create/edit payloads, active toggles, selection callbacks, and delete confirmation behavior.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/components/AdminGachaTierManager.test.jsx --run`
Expected: FAIL because the component is absent.

- [ ] **Step 3: Implement the focused tier manager**

Keep network mutations in the parent page and pass tier data/callbacks to a presentational component. Include name, price, order, active state, readiness reason, percentage total, and selected state.

- [ ] **Step 4: Verify component GREEN**

Run: `npm test -- src/app/components/AdminGachaTierManager.test.jsx --run`
Expected: PASS.

- [ ] **Step 5: Integrate tier queries and mutations in admin page**

Query `['admin-gacha-tiers']`, select one tier, query prizes with `?tierId=...`, send `tierId` for creates and moves, replace weight labels/math with exact percentage labels and totals, add `step="0.01" min="0" max="100"`, and invalidate both tier and prize queries after mutations. Keep stock modal invalidation scoped to the selected tier query.

- [ ] **Step 6: Run focused tests, lint, and build**

Run: `npm test -- src/app/components/AdminGachaTierManager.test.jsx --run && npm run lint -- src/app/admin/page.js src/app/components/AdminGachaTierManager.js src/app/components/AdminGachaStockModal.js && npm run build`
Expected: PASS and build exit code 0.

- [ ] **Step 7: Commit**

```powershell
git add src/app/admin/page.js src/app/components/AdminGachaTierManager.js src/app/components/AdminGachaTierManager.test.jsx src/app/components/AdminGachaStockModal.js
git commit -m "feat: manage gacha tiers and exact percentages"
```

### Task 9: Seed Data and End-to-End Verification

**Files:**
- Modify: `src/app/api/seed/route.js`
- Modify: `README.md` if deployment setup is documented there

- [ ] **Step 1: Write a failing seed contract test**

Create `src/app/api/seed/route.test.js` that verifies seed inserts the three tiers at 30/100/300 THB, resolves their IDs, and attaches every seeded prize to one tier with each tier totaling 100%.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/seed/route.test.js --run`
Expected: FAIL because seed data has no tiers.

- [ ] **Step 3: Update seed behavior**

Delete dependent gacha records in foreign-key-safe order, upsert the three stable tier slugs, insert tier-specific prize sets totaling 100%, include stock for every positive-percent code prize, and preserve unrelated shop seed behavior.

- [ ] **Step 4: Document database rollout**

If README contains setup instructions, add the exact order: back up database, run `supabase/migrations/20260704_multi_tier_gacha.sql`, verify three tiers, then deploy application. Do not instruct production operators to call the destructive seed route.

- [ ] **Step 5: Run complete fresh verification**

Run: `npm run test:run`
Expected: all tests pass, zero failures.

Run: `npm run lint`
Expected: exit code 0 with no errors.

Run: `npm run build`
Expected: production build exits 0.

Run: `git diff --check`
Expected: no output.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/seed/route.js src/app/api/seed/route.test.js README.md
git commit -m "feat: seed and document multi-tier gacha"
```

### Task 10: Manual Acceptance Check

- [ ] **Step 1: Start the app against a migrated development database**

Run: `npm run dev`
Expected: Next.js starts without route or schema errors.

- [ ] **Step 2: Verify customer behavior**

Confirm tier cards show 30/100/300 THB, selection changes wheel/prizes, unavailable tiers explain why, insufficient balance does not call a successful spin, and a successful result charges exactly the selected tier price.

- [ ] **Step 3: Verify administrator behavior**

Create a temporary tier, observe `0/100%`, add/edit/move prizes until 100%, toggle active state, exhaust/refill a code stock, verify readiness transitions, and verify a non-empty tier cannot be deleted.

- [ ] **Step 4: Verify records**

Confirm the selected tier, charged price, transaction, winner log, coupon/code ownership, user balance, and total spending agree after a spin. Submit two concurrent attempts against one remaining code and confirm at most one receives it.

- [ ] **Step 5: Record final verification evidence**

Capture test/lint/build counts and any database/manual checks in the handoff. Do not claim atomic database behavior was manually verified if no migrated development database was available.
