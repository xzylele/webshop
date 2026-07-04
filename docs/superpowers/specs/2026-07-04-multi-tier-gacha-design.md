# Multi-Tier Gacha System Design

## Objective

Extend the existing single-wheel gacha into a configurable multi-tier system. Administrators can create and manage tiers and their prizes, while customers choose a tier with its own price and exact published prize percentages.

## Product Decisions

- Tiers are administrator-defined rather than permanently fixed.
- Seed the system with Normal (30 THB), Premium (100 THB), and Luxury (300 THB).
- Each tier has its own price and prize pool.
- Prize probabilities are explicit percentages and must total exactly 100% per tier.
- A tier cannot be spun when its configuration is invalid or any active code prize is out of stock.
- The system never silently redistributes probability or replaces an out-of-stock result.

## Data Model

### `gacha_tiers`

- `id`: UUID primary key
- `name`: required display name
- `slug`: required unique stable identifier
- `price`: positive numeric spin price
- `is_active`: administrator-controlled availability
- `sort_order`: integer display order
- `created_at`, `updated_at`: timestamps

### `gacha_items` changes

- Add required `tier_id` referencing `gacha_tiers.id` after migration.
- Retain `name`, `type`, `chance`, `coupon_discount`, and `stock`.
- Interpret `chance` as an exact percentage from 0 through 100, not a relative weight.
- Add an index on `tier_id`.

### Existing records

The migration creates the three initial tiers, assigns every existing gacha item to Normal, and only then makes `tier_id` required. Existing prize percentages must be reviewed by an administrator; Normal remains unavailable until its percentages total 100 and all code prizes have stock.

Spin records and public winner records include the tier identity so the transaction history remains understandable after tier names or prices change.

## Availability Rules

A tier is spin-ready only when all conditions hold:

1. The administrator has enabled it.
2. Its price is greater than zero.
3. It contains at least one prize.
4. Prize percentages total exactly 100. Decimal percentages are supported and compared at two-decimal precision.
5. Every code prize with a percentage greater than zero has at least one unused code.

Customers may inspect an unavailable tier and its prize list, but cannot spin it. The API returns a specific reason, such as incomplete percentages or depleted stock. Administrator screens show the same readiness calculation.

## Customer Experience

The gacha page displays tier cards above the wheel. Each card shows name, price, and current availability. Selecting a tier updates the wheel, prize list, displayed percentages, and spin-button price without navigating away.

The selected tier ID is submitted to the spin endpoint. Unavailable tiers keep their prize details visible, while the spin button is disabled with a concise reason. Recent winners can include their tier name.

The initial selection is the first active, spin-ready tier by `sort_order`; if none are ready, the first visible tier is selected for inspection.

## Administrator Experience

The gacha administration area is divided into:

1. Tier management: create a tier, edit its name and price, change order, enable/disable it, and delete an empty tier.
2. Prize management: select a tier, then create, edit, delete, and manage stock for prizes belonging to that tier.

The selected tier displays a live percentage summary such as `85/100%`, including the amount missing or exceeded. Forms validate names, positive prices, supported prize types, coupon values, stock input, and percentages from 0 through 100.

A tier containing prizes cannot be deleted. An administrator must move or remove its prizes first. Prize editing supports changing its tier, allowing deliberate movement between pools; both affected tiers immediately recalculate readiness.

## API Design

### Public gacha API

- `GET /api/gacha/spin` returns visible tiers, their prizes, readiness status/reason, and recent winner logs.
- `POST /api/gacha/spin` accepts `{ tierId }` and returns the selected prize, delivered value, tier, charged price, new balance, and transaction ID.

The POST handler treats all client values as untrusted. It reloads the tier, price, prizes, percentages, stock, and user balance from the database.

### Administrator API

- Add a tier administration route with list, create, update, and delete operations.
- Extend the existing prize administration route to require and filter by `tierId`, allow moving a prize, and validate exact percentages.
- API validation mirrors form validation and returns Thai error messages suitable for display.

## Atomic Spin Flow

The spin is executed by a PostgreSQL function called through Supabase RPC so these operations occur in one transaction:

1. Lock and load the customer and selected tier.
2. Recheck tier readiness and balance.
3. Select a prize using a random value in `[0, 100)` and cumulative exact percentages.
4. Atomically claim one code when the selected prize is a code prize, or create a user-bound coupon for a coupon prize.
5. Deduct the tier price and increase total spending.
6. Create the financial transaction and winner/log records.
7. Return the completed result.

Any failure rolls back every operation. Concurrent requests therefore cannot distribute the same code or partially charge a customer.

## Probability Behavior

Percentages are stored as numeric values with at most two decimal places. The cumulative selection order is deterministic (for example, creation time followed by ID), while the random value determines the winner. A shared pure helper models validation and selection behavior for unit tests; the database function follows the same boundary rules.

No automatic normalization occurs. An invalid total blocks spins rather than changing advertised odds.

## Error Handling

- Authentication failures return 401; administrator authorization failures return 403.
- Missing resources return 404.
- Invalid prices, percentages, tier state, balance, or stock return 400/409 with a specific user-facing message.
- Unexpected database failures return a generic 500 response and are logged server-side without exposing secrets.
- The client refreshes tier data and balance after a successful spin and after stock/configuration mutations.

## Testing

Unit tests cover percentage precision and totals, readiness reasons, deterministic probability boundaries, and payload validation. Route tests cover tier filtering, rejected unavailable tiers, insufficient balance, and administrator authorization/validation. Database migration/RPC verification covers rollback behavior and concurrent code claims where the environment permits integration testing.

UI tests cover tier selection, dynamic prices and prizes, disabled-state reasons, percentage summaries, and administrator tier/prize forms. Final verification runs the complete test suite, lint, and production build.

## Scope Boundaries

This version does not add pity systems, multi-spin bundles, guaranteed rewards, scheduled tiers, per-user odds, prize images, or analytics dashboards. Those can build on tier and spin records later without changing the core model.
