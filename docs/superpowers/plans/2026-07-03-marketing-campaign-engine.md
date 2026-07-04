# Marketing Campaign Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-approved in-app marketing campaign engine that segments customers, schedules idempotent delivery, attributes coupon purchases, and reports campaign results.

**Architecture:** Keep audience rules, campaign state, attribution, and metrics in small pure modules; expose them through uncached Next.js Route Handlers backed by Supabase. PostgreSQL constraints and RPC functions own snapshot creation and job claiming, while UI components consume narrow APIs. This follows the installed Next.js 16.2.9 Route Handler and Vitest guides in `node_modules/next/dist/docs/`.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, JavaScript, Supabase/PostgreSQL, NextAuth 4, TanStack Query 5, Vitest, React Testing Library.

---

## File map

- `schema.sql`: campaign, recipient, event, notification, preference, audit tables; constraints, indexes, and transactional RPC functions.
- `vitest.config.js`, `src/test/setup.js`: unit/component test runtime.
- `src/lib/auth.js`: reusable server-side session and admin guards.
- `src/lib/campaigns/audience.js`: pure audience rules and reason labels.
- `src/lib/campaigns/domain.js`: state transitions, validation, URL safety, and discount exposure.
- `src/lib/campaigns/analytics.js`: pure funnel calculations.
- `src/lib/campaigns/repository.js`: all campaign Supabase queries and RPC calls.
- `src/lib/campaigns/delivery.js`: in-app adapter and idempotent batch delivery.
- `src/lib/campaigns/attribution.js`: records redemption/purchase events once.
- `src/app/api/admin/campaigns/route.js`: list, preview, create, update draft.
- `src/app/api/admin/campaigns/[id]/route.js`: detail, approve, cancel, pause, resume.
- `src/app/api/admin/campaigns/analytics/route.js`: dashboard metrics.
- `src/app/api/internal/campaigns/process/route.js`: secret-protected scheduler entry point.
- `src/app/api/notifications/route.js`: customer list/read APIs.
- `src/app/api/notifications/preferences/route.js`: customer marketing preference APIs.
- `src/app/components/CustomerNotificationBell.js`: customer notification dropdown.
- `src/app/components/admin/CampaignPanel.js`: campaign dashboard/list shell.
- `src/app/components/admin/CampaignComposer.js`: preview, compose, approve/schedule flow.
- `src/app/components/admin/CampaignReport.js`: funnel and audit detail.
- `src/app/admin/page.js`: adds the campaign tab only; campaign behavior stays in focused components.
- `src/app/components/Navbar.js`: mounts the customer bell.
- `src/app/inventory/page.js`: adds marketing preference control.
- `src/app/api/purchase/route.js`, `src/app/api/purchase/cart/route.js`: call attribution after a completed coupon purchase.
- `.env.example`: documents `CAMPAIGN_SCHEDULER_SECRET`.

## Task 1: Install and prove the test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/lib/campaigns/smoke.test.js`

- [ ] **Step 1: Install the dependencies documented by the bundled Next.js Vitest guide**

Run: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom`

Expected: exit 0 and only `package.json`/`package-lock.json` dependency changes.

- [ ] **Step 2: Add the test scripts and configuration**

Add scripts `"test": "vitest"` and `"test:run": "vitest run"`. Create:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.js'] }
});
```

```js
// src/test/setup.js
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
```

- [ ] **Step 3: Write and run the smoke test**

```js
// src/lib/campaigns/smoke.test.js
import { expect, test } from 'vitest';

test('vitest resolves the campaign test directory', () => {
  expect(2 + 2).toBe(4);
});
```

Run: `npm run test:run -- src/lib/campaigns/smoke.test.js`

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json vitest.config.js src/test/setup.js src/lib/campaigns/smoke.test.js
git commit -m "test: add campaign test harness"
```

## Task 2: Add the database contract and transactional RPCs

**Files:**
- Modify: `schema.sql`
- Create: `src/lib/campaigns/schema.test.js`

- [ ] **Step 1: Write a failing schema contract test**

Read `schema.sql` with `readFileSync` and assert all required names exist:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const sql = readFileSync(new URL('../../../schema.sql', import.meta.url), 'utf8');

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
});
```

Run: `npm run test:run -- src/lib/campaigns/schema.test.js`

Expected: FAIL because campaign tables do not exist.

- [ ] **Step 2: Append the campaign schema**

Add the six tables named above with UUID keys, foreign keys, `CHECK` constraints for campaign status/channel/event type, timestamps, JSONB rules/metadata, indexes on due campaigns and unread notifications, RLS enabled, and no public policies. Add `campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL` to `coupons` so one coupon belongs to at most one campaign.

The `approve_campaign(p_campaign_id, p_admin_id)` security-definer function must lock the draft, validate the coupon, insert opted-in/frequency-capped recipients from a supplied audience staging query, set approver/time/status, and write an audit row atomically. The `claim_due_campaigns(p_limit)` function must use `FOR UPDATE SKIP LOCKED`, move due jobs to `sending`, and return claimed IDs. Revoke both functions from `PUBLIC`; grant only to `service_role`.

- [ ] **Step 3: Run the contract and lint checks**

Run: `npm run test:run -- src/lib/campaigns/schema.test.js`

Expected: all schema contract tests pass.

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 4: Apply `schema.sql` in the project Supabase SQL editor and verify the RPCs**

Run in SQL editor:

```sql
select proname from pg_proc where proname in ('approve_campaign', 'claim_due_campaigns');
```

Expected: exactly two rows. Do not continue against a shared environment until this succeeds.

- [ ] **Step 5: Commit**

```powershell
git add schema.sql src/lib/campaigns/schema.test.js
git commit -m "feat: add campaign database schema"
```

## Task 3: Implement audience segmentation with boundary tests

**Files:**
- Create: `src/lib/campaigns/audience.js`
- Create: `src/lib/campaigns/audience.test.js`

- [ ] **Step 1: Write failing tests for all three rules**

Use a fixed `now = new Date('2026-07-03T00:00:00Z')`. Assert that exactly 30 inactive days qualifies, 29 does not; exactly three same-category purchases in 90 days qualifies; mixed categories do not; and VIP requires at least three purchases and a lifetime-spend cutoff.

```js
import { describe, expect, test } from 'vitest';
import { classifyCustomer } from './audience';

const now = new Date('2026-07-03T00:00:00Z');

test('classifies the 30-day inactivity boundary', () => {
  const result = classifyCustomer({ purchases: [{ createdAt: '2026-06-03T00:00:00Z', category: 'game', amount: 100 }], lifetimeSpend: 100 }, { now, vipCutoff: 500 });
  expect(result.map(item => item.type)).toContain('inactive_30_days');
});

test('requires three purchases in one category', () => {
  const purchases = ['2026-06-01', '2026-06-10', '2026-06-20'].map(createdAt => ({ createdAt, category: 'steam', amount: 100 }));
  expect(classifyCustomer({ purchases, lifetimeSpend: 300 }, { now, vipCutoff: 500 })).toContainEqual(expect.objectContaining({ type: 'frequent_category', category: 'steam' }));
});

test('requires purchase count and cutoff for vip', () => {
  const purchases = [1, 2, 3].map(day => ({ createdAt: `2026-06-0${day}`, category: 'game', amount: 400 }));
  expect(classifyCustomer({ purchases, lifetimeSpend: 1200 }, { now, vipCutoff: 1000 }).map(item => item.type)).toContain('vip');
});
```

Run: `npm run test:run -- src/lib/campaigns/audience.test.js`

Expected: FAIL because `audience.js` is missing.

- [ ] **Step 2: Implement the pure rule module**

Export `AUDIENCE_DEFAULTS`, `classifyCustomer(customer, context)`, and `buildAudiencePreview(customers, rule, context)`. Treat dates as UTC, count only completed purchases supplied by the repository, and return `{ type, reason, category? }` objects rather than booleans.

- [ ] **Step 3: Run tests and commit**

Run: `npm run test:run -- src/lib/campaigns/audience.test.js`

Expected: all audience tests pass.

```powershell
git add src/lib/campaigns/audience.js src/lib/campaigns/audience.test.js
git commit -m "feat: add campaign audience rules"
```

## Task 4: Implement campaign domain rules and metrics

**Files:**
- Create: `src/lib/campaigns/domain.js`
- Create: `src/lib/campaigns/domain.test.js`
- Create: `src/lib/campaigns/analytics.js`
- Create: `src/lib/campaigns/analytics.test.js`

- [ ] **Step 1: Write failing domain tests**

Assert allowed/forbidden state transitions, internal paths and allowlisted HTTPS URLs, coupon expiry after scheduled time, percentage exposure capped by `max_discount`, and fixed-discount exposure.

```js
expect(canTransition('draft', 'approved')).toBe(true);
expect(canTransition('sending', 'draft')).toBe(false);
expect(isSafeActionUrl('/products?category=steam', [])).toBe(true);
expect(isSafeActionUrl('javascript:alert(1)', [])).toBe(false);
expect(maxDiscountExposure({ type: 'fixed', discount: 50 }, 10)).toBe(500);
```

- [ ] **Step 2: Implement `domain.js` and make tests pass**

Export `CAMPAIGN_TRANSITIONS`, `canTransition`, `validateCampaignDraft`, `isSafeActionUrl`, and `maxDiscountExposure`. Validation returns `{ valid, errors }` with stable field keys so APIs and UI share the same contract.

- [ ] **Step 3: Write failing analytics tests**

Given four recipients with three sent, two opened, one clicked, one redeemed/purchased for amount 250, assert delivery `0.75`, open `2/3`, click `1/3`, conversion `1/3`, revenue `250`, and returning customers `1`.

- [ ] **Step 4: Implement `calculateCampaignMetrics({ recipients, events })`**

Deduplicate people per event type, count only completed attributed purchases, and return raw counts plus rates; rates with a zero denominator are `0`, never `NaN`.

- [ ] **Step 5: Run and commit**

Run: `npm run test:run -- src/lib/campaigns/domain.test.js src/lib/campaigns/analytics.test.js`

Expected: all tests pass.

```powershell
git add src/lib/campaigns/domain.js src/lib/campaigns/domain.test.js src/lib/campaigns/analytics.js src/lib/campaigns/analytics.test.js
git commit -m "feat: add campaign domain and analytics"
```

## Task 5: Centralize authorization and repository access

**Files:**
- Create: `src/lib/auth.js`
- Create: `src/lib/auth.test.js`
- Create: `src/lib/campaigns/repository.js`
- Create: `src/lib/campaigns/repository.test.js`

- [ ] **Step 1: Test `requireSession` and `requireAdmin` with injected session loaders**

Assert unauthenticated returns status 401, ordinary user returns 403 for admin, and admin returns the session. Use a small `HttpError` carrying `status` and `message`.

- [ ] **Step 2: Implement the guards using `getServerSession(authOptions)` by default**

The optional loader argument exists only to make the guard deterministic in tests. Replace duplicated `checkAdmin` only in new campaign routes; unrelated routes remain untouched.

- [ ] **Step 3: Test repository query shapes with a chainable Supabase fake**

Cover `previewAudience`, `createCampaign`, `updateDraft`, `approveCampaign`, `listCampaigns`, `getCampaignDetail`, `claimDueCampaigns`, `listPendingRecipients`, `markRecipientResult`, and `getAnalyticsInput`. Verify RPC names and that returned numeric database values are normalized to numbers.

- [ ] **Step 4: Implement the repository with dependency injection**

Export `createCampaignRepository(client = supabaseAdmin)` returning the methods listed above. No UI or Route Handler may call campaign tables directly.

- [ ] **Step 5: Run and commit**

Run: `npm run test:run -- src/lib/auth.test.js src/lib/campaigns/repository.test.js`

Expected: all tests pass.

```powershell
git add src/lib/auth.js src/lib/auth.test.js src/lib/campaigns/repository.js src/lib/campaigns/repository.test.js
git commit -m "feat: add campaign authorization and repository"
```

## Task 6: Add admin campaign APIs

**Files:**
- Create: `src/app/api/admin/campaigns/route.js`
- Create: `src/app/api/admin/campaigns/[id]/route.js`
- Create: `src/app/api/admin/campaigns/analytics/route.js`
- Create: `src/app/api/admin/campaigns/routes.test.js`

- [ ] **Step 1: Write failing handler tests**

Mock guards/repository and call handlers with Web `Request` objects. Cover 403, invalid draft 400, unsafe action URL 400, successful preview/create/update, immutable approved campaign 409, approve/cancel/pause/resume, and analytics response.

- [ ] **Step 2: Implement uncached Route Handlers**

Use `export const dynamic = 'force-dynamic'`. Contract:

- `GET /api/admin/campaigns?view=list|preview&template=...`
- `POST /api/admin/campaigns` creates a draft
- `PUT /api/admin/campaigns` updates a draft
- `GET /api/admin/campaigns/:id` returns detail
- `POST /api/admin/campaigns/:id` accepts `{ action: 'approve'|'cancel'|'pause'|'resume' }`
- `GET /api/admin/campaigns/analytics?campaignId=...` returns counts/rates

Return `{ data }` on success and `{ error, fields? }` on failure. Map `HttpError` status directly; log unexpected errors and return 500 without database details.

- [ ] **Step 3: Run and commit**

Run: `npm run test:run -- src/app/api/admin/campaigns/routes.test.js`

Expected: all handler tests pass.

```powershell
git add src/app/api/admin/campaigns src/lib/campaigns
git commit -m "feat: add admin campaign APIs"
```

## Task 7: Add idempotent delivery and scheduler processing

**Files:**
- Create: `src/lib/campaigns/delivery.js`
- Create: `src/lib/campaigns/delivery.test.js`
- Create: `src/app/api/internal/campaigns/process/route.js`
- Create: `src/app/api/internal/campaigns/process/route.test.js`
- Modify: `.env.example`

- [ ] **Step 1: Write failing delivery tests**

Assert opted-out recipients are skipped, prior success is skipped, duplicate insert is treated as already delivered, transient failure increments attempts, retry ceiling pauses the campaign, and a complete batch marks it completed.

- [ ] **Step 2: Implement delivery boundaries**

Export `createInAppAdapter(repository)` with `send(recipient, campaign)` and `processCampaignBatch(repository, adapter, campaignId, { limit: 100, maxAttempts: 3 })`. The adapter inserts notification and `sent` event through one repository RPC keyed by recipient; it never performs raw inserts itself.

- [ ] **Step 3: Write failing scheduler route tests**

Test absent/wrong `Authorization: Bearer <secret>` returns 401; correct secret claims at most 10 campaigns and returns `{ claimed, completed, paused }`; a second call with no work returns zero counts.

- [ ] **Step 4: Implement the scheduler Route Handler**

Use `POST`, `dynamic = 'force-dynamic'`, `crypto.timingSafeEqual` for non-empty equal-length secrets, `claimDueCampaigns(10)`, and sequential campaign processing to cap database pressure. Document `CAMPAIGN_SCHEDULER_SECRET=` in `.env.example`.

- [ ] **Step 5: Run and commit**

Run: `npm run test:run -- src/lib/campaigns/delivery.test.js src/app/api/internal/campaigns/process/route.test.js`

Expected: all tests pass.

```powershell
git add src/lib/campaigns/delivery.js src/lib/campaigns/delivery.test.js src/app/api/internal/campaigns/process .env.example
git commit -m "feat: process scheduled campaign delivery"
```

## Task 8: Add customer notification and preference APIs

**Files:**
- Create: `src/app/api/notifications/route.js`
- Create: `src/app/api/notifications/preferences/route.js`
- Create: `src/app/api/notifications/routes.test.js`

- [ ] **Step 1: Write failing ownership and preference tests**

Cover list only current user's notifications, mark one/read-all, reject another user's notification, record `opened` once, read preference default `true`, and update preference.

- [ ] **Step 2: Implement the APIs**

Contract:

- `GET /api/notifications?limit=20`
- `PATCH /api/notifications` with `{ id }` or `{ all: true }`
- `POST /api/notifications` with `{ id, action: 'clicked' }`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences` with `{ inAppMarketing: boolean }`

Every query includes `.eq('user_id', session.user.id)`. Open/click event insertion uses an idempotency conflict target.

- [ ] **Step 3: Run and commit**

Run: `npm run test:run -- src/app/api/notifications/routes.test.js`

Expected: all tests pass.

```powershell
git add src/app/api/notifications
git commit -m "feat: add customer notification APIs"
```

## Task 9: Attribute successful coupon purchases

**Files:**
- Create: `src/lib/campaigns/attribution.js`
- Create: `src/lib/campaigns/attribution.test.js`
- Modify: `src/app/api/purchase/route.js`
- Modify: `src/app/api/purchase/cart/route.js`

- [ ] **Step 1: Write failing attribution tests**

Assert no coupon is a no-op, ordinary coupon is a no-op, campaign coupon inserts `coupon_redeemed` and `purchased`, amount is normalized, inactive recipient is rejected, and repeating the same transaction remains one pair of events.

- [ ] **Step 2: Implement `recordCampaignPurchase`**

Signature:

```js
export async function recordCampaignPurchase({ repository, couponId, userId, transactionId, amount })
```

Resolve the campaign through `coupons.campaign_id`, find its recipient, and call one idempotent repository/RPC operation. Return `{ attributed: false }` for non-campaign coupons and `{ attributed: true, campaignId }` for success.

- [ ] **Step 3: Integrate both purchase routes**

After transaction insertion succeeds, call the helper with `couponUsed?.id`, `user.id`, `transaction.id`, and final charged amount. Attribution failure must be logged and surfaced as a 500 until purchase operations are moved into a single database RPC; do not silently report checkout success with missing attribution.

- [ ] **Step 4: Run and commit**

Run: `npm run test:run -- src/lib/campaigns/attribution.test.js`

Expected: all attribution tests pass.

Run: `npm run lint`

Expected: exit 0.

```powershell
git add src/lib/campaigns/attribution.js src/lib/campaigns/attribution.test.js src/app/api/purchase/route.js src/app/api/purchase/cart/route.js
git commit -m "feat: attribute campaign purchases"
```

## Task 10: Build the customer notification experience

**Files:**
- Create: `src/app/components/CustomerNotificationBell.js`
- Create: `src/app/components/CustomerNotificationBell.test.js`
- Modify: `src/app/components/Navbar.js`
- Modify: `src/app/inventory/page.js`

- [ ] **Step 1: Write failing component tests**

Render with a QueryClient and mocked fetch. Assert unread badge, dropdown list, read-all, safe navigation click tracking, empty state, and hidden bell when signed out. Add a preference-control test that loads the current value and sends `PUT` when toggled.

- [ ] **Step 2: Implement `CustomerNotificationBell`**

Use TanStack Query keys `['customer-notifications']` and `['marketing-preferences']`, poll every 30 seconds while signed in, mark read before navigation, and render Thai accessible labels. Do not use raw HTML for server-provided text.

- [ ] **Step 3: Mount it and add preferences**

Place the customer bell beside the cart for authenticated non-admin and admin users; keep `AdminNotificationBell` admin-only. Add a clearly labelled marketing toggle to inventory/account content with optimistic UI rollback on failure.

- [ ] **Step 4: Run and commit**

Run: `npm run test:run -- src/app/components/CustomerNotificationBell.test.js`

Expected: all component tests pass.

```powershell
git add src/app/components/CustomerNotificationBell.js src/app/components/CustomerNotificationBell.test.js src/app/components/Navbar.js src/app/inventory/page.js
git commit -m "feat: add customer notification center"
```

## Task 11: Build the admin campaign dashboard

**Files:**
- Create: `src/app/components/admin/CampaignPanel.js`
- Create: `src/app/components/admin/CampaignComposer.js`
- Create: `src/app/components/admin/CampaignReport.js`
- Create: `src/app/components/admin/CampaignPanel.test.js`
- Modify: `src/app/admin/page.js`

- [ ] **Step 1: Write failing admin UI tests**

Mock APIs and cover the three recommendation cards, audience count/reason, maximum exposure, draft validation, approve confirmation, immediate/scheduled mode, status filters, error state, funnel metrics, and immutable approved form.

- [ ] **Step 2: Implement focused components**

`CampaignPanel` owns queries and selected campaign; `CampaignComposer` owns draft form and preview; `CampaignReport` receives already-normalized metrics. Use the existing zinc/sky visual language, Thai labels, loading skeletons, empty states, and explicit confirmation before approval.

- [ ] **Step 3: Add only tab wiring to the large admin page**

Import `Megaphone` and `CampaignPanel`, add `campaigns` to the active-tab comment, add one tab button, and render `<CampaignPanel />` for that tab. Do not place campaign fetching or forms directly in `src/app/admin/page.js`.

- [ ] **Step 4: Run and commit**

Run: `npm run test:run -- src/app/components/admin/CampaignPanel.test.js`

Expected: all admin component tests pass.

```powershell
git add src/app/components/admin src/app/admin/page.js
git commit -m "feat: add admin campaign dashboard"
```

## Task 12: Full verification and operating notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document setup and operation**

Add a “Marketing campaigns” section covering schema application, `CAMPAIGN_SCHEDULER_SECRET`, the scheduler `POST /api/internal/campaigns/process`, recommended one-minute cadence, retry behavior, frequency cap, and how a customer opts out.

- [ ] **Step 2: Run the complete automated checks**

Run: `npm run test:run`

Expected: all tests pass with zero unhandled errors.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: Next.js production build exits 0 and lists all new Route Handlers.

- [ ] **Step 3: Perform the end-to-end acceptance flow**

Use a disposable admin and customer in a non-production Supabase project: create a campaign from each template; approve one immediate campaign; call the scheduler twice; verify one notification; open/click it; purchase with the campaign coupon; confirm one redemption, one purchase event, correct revenue/conversion, and an audit trail. Turn marketing off, schedule another campaign, run the scheduler, and verify no new marketing notification.

- [ ] **Step 4: Inspect the final diff and commit**

Run: `git diff --check`

Expected: no output.

```powershell
git add README.md
git commit -m "docs: add campaign operating guide"
```

## Requirement coverage

- Three audience templates: Tasks 2–3 and 11.
- Admin preview, approval, schedule, cancellation, pause/resume: Tasks 4–7 and 11.
- In-app adapter with future channel boundary: Tasks 2, 5, and 7.
- Notification bell and opt-out: Tasks 8 and 10.
- Delivery/open/click/redemption/purchase metrics: Tasks 4, 8, 9, and 11.
- Idempotency, retries, frequency cap, audit, ownership, URL safety: Tasks 2, 4, 6–9.
- Production verification and operating documentation: Task 12.

