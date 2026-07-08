-- ==========================================
-- Database Schema for Webshop (Supabase)
-- Run these queries in the SQL Editor of your Supabase project.
-- ==========================================

-- 1. Table: Banners (Required to fix the GET/POST /api/banners 500 error)
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '/products',
    action_text TEXT DEFAULT 'เธ”เธนเธชเธดเธเธเนเธฒเธ—เธฑเนเธเธซเธกเธ”',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for Banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Create policies for Banners
DROP POLICY IF EXISTS "Allow public read banners" ON public.banners;
CREATE POLICY "Allow public read banners" 
ON public.banners 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow all for service_role on banners" ON public.banners;
-- No write policy is needed: service_role bypasses RLS.


-- 2. Table: Users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    balance NUMERIC DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow all for service_role on users" ON public.users;
-- User records contain password hashes and must only be accessed by server APIs.


-- 3. Table: Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    image TEXT,
    category TEXT,
    subcategory TEXT,
    stock INT DEFAULT 0,
    stock_type TEXT DEFAULT 'manual', -- 'manual' | 'code'
    sold INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read products" ON public.products;
CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all for service_role on products" ON public.products;


-- 4. Table: Product Codes (For digital keys stock)
CREATE TABLE IF NOT EXISTS public.product_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read product_codes" ON public.product_codes;
DROP POLICY IF EXISTS "Allow all for service_role on product_codes" ON public.product_codes;
-- Product codes are secrets and must only be accessed by server APIs.


-- 5. Table: Coupons
-- Must be created before transactions because transactions.coupon_id references it.
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount NUMERIC NOT NULL,
    type TEXT DEFAULT 'fixed' CHECK (type IN ('fixed', 'percentage')),
    max_discount NUMERIC DEFAULT NULL,
    min_purchase NUMERIC DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    max_uses_per_user INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow all for service_role on coupons" ON public.coupons;


-- 6. Table: Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'purchase' | 'topup' | 'adjust'
    amount NUMERIC NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all for service_role on transactions" ON public.transactions;


-- 7. Table: Gacha Tiers and Items
CREATE TABLE IF NOT EXISTS public.gacha_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.gacha_tiers (name, slug, price, sort_order)
VALUES
    ('Normal', 'normal', 30, 10),
    ('Premium', 'premium', 100, 20),
    ('Luxury', 'luxury', 300, 30)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.gacha_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read gacha_tiers" ON public.gacha_tiers;
DROP POLICY IF EXISTS "Allow all for service_role on gacha_tiers" ON public.gacha_tiers;

CREATE TABLE IF NOT EXISTS public.gacha_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID NOT NULL REFERENCES public.gacha_tiers(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('empty', 'coupon', 'code', 'topup')),
    chance NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (chance >= 0 AND chance <= 100),
    coupon_discount NUMERIC DEFAULT 0,
    topup_amount NUMERIC DEFAULT 0,
    stock TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gacha_items_tier_id_idx ON public.gacha_items (tier_id, created_at, id);

ALTER TABLE public.gacha_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read gacha_items" ON public.gacha_items;
DROP POLICY IF EXISTS "Allow all for service_role on gacha_items" ON public.gacha_items;
-- stock can contain redeemable codes, so gacha items are exposed through server APIs only.


-- 8. Table: Gacha Won Codes
CREATE TABLE IF NOT EXISTS public.gacha_won_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gacha_item_id UUID REFERENCES public.gacha_items(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    won_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    won_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gacha_won_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read gacha_won_codes" ON public.gacha_won_codes;
DROP POLICY IF EXISTS "Allow all for service_role on gacha_won_codes" ON public.gacha_won_codes;


-- 9. Table: Gacha Logs
CREATE TABLE IF NOT EXISTS public.gacha_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT,
    prize_name TEXT,
    tier_id UUID REFERENCES public.gacha_tiers(id) ON DELETE SET NULL,
    tier_name TEXT,
    tier_price NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gacha_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read gacha_logs" ON public.gacha_logs;
DROP POLICY IF EXISTS "Allow all for service_role on gacha_logs" ON public.gacha_logs;


-- 9b. Table: Topup Codes (For gacha topup prizes)
CREATE TABLE IF NOT EXISTS public.topup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topup_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role on topup_codes" ON public.topup_codes;


-- 10. Table: Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'product' | 'topup' | 'gacha' | 'other'
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open' | 'replied' | 'closed'
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow users to insert their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow all for service_role on support_tickets" ON public.support_tickets;
-- This app uses NextAuth, not Supabase Auth. Ownership is checked in server APIs.


-- 11. Table: Support Messages (Chat replies)
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read messages of their own tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Allow users to insert replies in their own tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Allow all for service_role on support_messages" ON public.support_messages;


-- 12. Table: Admin Notifications (in-app alerts for admins)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'new_ticket' | 'ticket_reply' | 'topup' | 'purchase' | 'low_stock'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT DEFAULT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service_role on admin_notifications" ON public.admin_notifications;


-- ==========================================
-- Marketing Campaign Engine
-- ==========================================

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('inactive_30_days', 'frequent_category', 'vip')),
    audience_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE RESTRICT,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app')),
    scheduled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'scheduled', 'sending', 'paused', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app')),
    audience_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
    delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
    sent_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, user_id, channel)
);

CREATE TABLE IF NOT EXISTS public.customer_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
    notification_type TEXT NOT NULL DEFAULT 'marketing'
        CHECK (notification_type IN ('marketing', 'transactional', 'security')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL
        CHECK (event_type IN ('sent', 'opened', 'clicked', 'coupon_redeemed', 'purchased')),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    amount NUMERIC,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, recipient_id, event_type, transaction_id)
);

CREATE TABLE IF NOT EXISTS public.user_marketing_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    in_app_marketing BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL
        CHECK (action IN ('created', 'updated', 'approved', 'cancelled', 'paused', 'resumed', 'completed')),
    from_status TEXT,
    to_status TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons
    ADD COLUMN IF NOT EXISTS campaign_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'coupons_campaign_id_fkey'
          AND conrelid = 'public.coupons'::regclass
    ) THEN
        ALTER TABLE public.coupons
            ADD CONSTRAINT coupons_campaign_id_fkey
            FOREIGN KEY (campaign_id)
            REFERENCES public.campaigns(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS coupons_campaign_id_unique
    ON public.coupons (campaign_id)
    WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaigns_due_idx
    ON public.campaigns (scheduled_at, created_at)
    WHERE status IN ('approved', 'scheduled');

CREATE INDEX IF NOT EXISTS campaign_recipients_pending_idx
    ON public.campaign_recipients (campaign_id, status, created_at);

CREATE INDEX IF NOT EXISTS customer_notifications_unread_idx
    ON public.customer_notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_notifications_recipient_unique
    ON public.customer_notifications (recipient_id)
    WHERE recipient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_events_without_transaction_unique
    ON public.campaign_events (campaign_id, recipient_id, event_type)
    WHERE transaction_id IS NULL;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.approve_campaign(
    p_campaign_id UUID,
    p_admin_id UUID
)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campaign public.campaigns;
    v_coupon public.coupons;
    v_candidate JSONB;
    v_candidate_user_id UUID;
    v_candidate_reason TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = p_admin_id
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_campaign
    FROM public.campaigns
    WHERE id = p_campaign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'campaign not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_campaign.status <> 'draft' THEN
        RAISE EXCEPTION 'only draft campaigns can be approved' USING ERRCODE = '23514';
    END IF;

    IF v_campaign.coupon_id IS NULL THEN
        RAISE EXCEPTION 'campaign coupon is required' USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO v_coupon
    FROM public.coupons
    WHERE id = v_campaign.coupon_id
    FOR UPDATE;

    IF NOT FOUND
       OR NOT v_coupon.is_active
       OR (
           v_coupon.expires_at IS NOT NULL
           AND v_coupon.expires_at <= COALESCE(v_campaign.scheduled_at, now())
       ) THEN
        RAISE EXCEPTION 'campaign coupon is unavailable or expires before delivery'
            USING ERRCODE = '23514';
    END IF;

    IF v_coupon.campaign_id IS NOT NULL
       AND v_coupon.campaign_id <> p_campaign_id THEN
        RAISE EXCEPTION 'coupon already belongs to another campaign'
            USING ERRCODE = '23505';
    END IF;

    FOR v_candidate IN
        SELECT value
        FROM jsonb_array_elements(
            COALESCE(v_campaign.audience_rules -> 'candidates', '[]'::jsonb)
        )
    LOOP
        BEGIN
            v_candidate_user_id := (v_candidate ->> 'user_id')::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'audience candidate has an invalid user_id'
                    USING ERRCODE = '22023';
        END;

        v_candidate_reason := NULLIF(v_candidate ->> 'reason', '');

        IF v_candidate_reason IS NULL THEN
            RAISE EXCEPTION 'audience candidate reason is required'
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.campaign_recipients (
            campaign_id,
            user_id,
            channel,
            audience_reason
        )
        SELECT
            v_campaign.id,
            u.id,
            v_campaign.channel,
            v_candidate_reason
        FROM public.users AS u
        LEFT JOIN public.user_marketing_preferences AS preference
            ON preference.user_id = u.id
        WHERE u.id = v_candidate_user_id
          AND COALESCE(preference.in_app_marketing, true)
          AND NOT EXISTS (
              SELECT 1
              FROM public.campaign_recipients AS recent_recipient
              JOIN public.campaigns AS recent_campaign
                ON recent_campaign.id = recent_recipient.campaign_id
              WHERE recent_recipient.user_id = u.id
                AND recent_recipient.channel = v_campaign.channel
                AND recent_campaign.id <> v_campaign.id
                AND recent_campaign.status <> 'cancelled'
                AND COALESCE(recent_recipient.sent_at, recent_recipient.created_at)
                    >= now() - INTERVAL '7 days'
          )
        ON CONFLICT (campaign_id, user_id, channel) DO NOTHING;
    END LOOP;

    UPDATE public.coupons
    SET campaign_id = p_campaign_id
    WHERE id = v_campaign.coupon_id;

    UPDATE public.campaigns
    SET approved_by = p_admin_id,
        approved_at = now(),
        status = CASE
            WHEN scheduled_at IS NULL OR scheduled_at <= now() THEN 'approved'
            ELSE 'scheduled'
        END,
        updated_at = now()
    WHERE id = p_campaign_id
    RETURNING * INTO v_campaign;

    INSERT INTO public.campaign_audit_logs (
        campaign_id,
        actor_id,
        action,
        from_status,
        to_status,
        metadata
    )
    VALUES (
        p_campaign_id,
        p_admin_id,
        'approved',
        'draft',
        v_campaign.status,
        jsonb_build_object(
            'recipient_count',
            (
                SELECT count(*)
                FROM public.campaign_recipients
                WHERE campaign_id = p_campaign_id
            )
        )
    );

    RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_campaigns(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (campaign_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'p_limit must be between 1 and 100'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH due AS (
        SELECT id
        FROM public.campaigns
        WHERE status IN ('approved', 'scheduled')
          AND COALESCE(scheduled_at, approved_at, created_at) <= now()
        ORDER BY COALESCE(scheduled_at, approved_at, created_at), id
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.campaigns AS campaign
    SET status = 'sending',
        started_at = COALESCE(campaign.started_at, now()),
        updated_at = now()
    FROM due
    WHERE campaign.id = due.id
    RETURNING campaign.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_campaign(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_due_campaigns(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_campaign(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_campaigns(INTEGER) TO service_role;


-- Multi-tier gacha upgrade and atomic spin

BEGIN;

CREATE TABLE IF NOT EXISTS public.gacha_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.gacha_tiers (name, slug, price, sort_order)
VALUES
    ('Normal', 'normal', 30, 10),
    ('Premium', 'premium', 100, 20),
    ('Luxury', 'luxury', 300, 30)
ON CONFLICT (slug) DO UPDATE
SET price = EXCLUDED.price,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE public.gacha_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read gacha_tiers" ON public.gacha_tiers;
DROP POLICY IF EXISTS "Allow all for service_role on gacha_tiers" ON public.gacha_tiers;

ALTER TABLE public.gacha_items
    ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.gacha_tiers(id) ON DELETE RESTRICT;

UPDATE public.gacha_items
SET tier_id = (SELECT id FROM public.gacha_tiers WHERE slug = 'normal')
WHERE tier_id IS NULL;

ALTER TABLE public.gacha_items ALTER COLUMN tier_id SET NOT NULL;
ALTER TABLE public.gacha_items ALTER COLUMN chance TYPE NUMERIC(5,2) USING round(chance::numeric, 2);
ALTER TABLE public.gacha_items ALTER COLUMN chance SET DEFAULT 0;
ALTER TABLE public.gacha_items ALTER COLUMN chance SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'gacha_items_type_check'
          AND conrelid = 'public.gacha_items'::regclass
    ) THEN
        ALTER TABLE public.gacha_items
            ADD CONSTRAINT gacha_items_type_check CHECK (type IN ('empty', 'coupon', 'code', 'topup'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'gacha_items_chance_range'
          AND conrelid = 'public.gacha_items'::regclass
    ) THEN
        ALTER TABLE public.gacha_items
            ADD CONSTRAINT gacha_items_chance_range CHECK (chance >= 0 AND chance <= 100);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS gacha_items_tier_id_idx
    ON public.gacha_items (tier_id, created_at, id);

ALTER TABLE public.gacha_logs
    ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.gacha_tiers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tier_name TEXT,
    ADD COLUMN IF NOT EXISTS tier_price NUMERIC(12,2);

CREATE OR REPLACE FUNCTION public.spin_gacha(
    p_user_id UUID,
    p_tier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users;
    v_tier public.gacha_tiers;
    v_item public.gacha_items;
    v_selected_item public.gacha_items;
    v_total_basis_points INTEGER;
    v_random_basis_points INTEGER;
    v_cursor INTEGER;
    v_item_basis_points INTEGER;
    v_code TEXT;
    v_public_value TEXT := '';
    v_coupon_code TEXT;
    v_transaction public.transactions;
    v_description TEXT;
BEGIN
    SELECT * INTO v_user
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'เน„เธกเนˆเธžเธšเธ‚เน‰เธญเธกเธนเธฅเธœเธนเน‰เนƒเธŠเน‰เธ‡เธฒเธ™' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_tier
    FROM public.gacha_tiers
    WHERE id = p_tier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'เน„เธกเนˆเธžเธšเธฃเธฐเธ”เธฑเธšเธ เธฒเธŠเธฒ' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_tier.is_active THEN
        RAISE EXCEPTION 'เธฃเธฐเธ”เธฑเธšเธ เธฒเธŠเธฒเธ™เธตเน‰เธ›เธดเธ”เนƒเธŠเน‰เธ‡เธฒเธ™' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(sum(round(chance * 100)), 0)::INTEGER
    INTO v_total_basis_points
    FROM public.gacha_items
    WHERE tier_id = p_tier_id;

    IF v_total_basis_points <> 10000 THEN
        RAISE EXCEPTION 'เน€เธ›เธญเธฃเนŒเน€เธ‹เน‡เธ™เธ•เนŒเธฃเธฒเธ‡เธงเธฑเธฅเธ•เน‰เธญเธ‡เธฃเธงเธกเธ„เธฃเธš 100%%' USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.gacha_items
        WHERE tier_id = p_tier_id
          AND type = 'code'
          AND chance > 0
          AND COALESCE(array_length(stock, 1), 0) = 0
    ) THEN
        RAISE EXCEPTION 'เธฃเธฒเธ‡เธงเธฑเธฅเน‚เธ„เน‰เธ”เธกเธตเธชเธ•เน‡เธญเธ เน„เธกเนˆเน€เธžเธตเธขเธ‡เธžเธญ' USING ERRCODE = 'P0001';
    END IF;

    IF v_user.balance < v_tier.price THEN
        RAISE EXCEPTION 'เธขเธญเธ”เน€เธ‡เธดเธ™เธ„เธ‡เน€เธซเธฅเธทเธญเน„เธกเนˆเน€เธžเธตเธขเธ‡เธžเธญ' USING ERRCODE = 'P0001';
    END IF;

    v_random_basis_points := floor(random() * 10000)::INTEGER;
    v_cursor := v_random_basis_points;

    FOR v_item IN
        SELECT * FROM public.gacha_items
        WHERE tier_id = p_tier_id
        ORDER BY created_at, id
        FOR UPDATE
    LOOP
        v_item_basis_points := round(v_item.chance * 100)::INTEGER;
        IF v_cursor < v_item_basis_points THEN
            v_selected_item := v_item;
            EXIT;
        END IF;
        v_cursor := v_cursor - v_item_basis_points;
    END LOOP;

    IF v_selected_item.id IS NULL THEN
        RAISE EXCEPTION 'เน„เธกเนˆเธชเธฒเธกเธฒเธฃเธ–เน€เธฅเธทเธญเธ เธฃเธฒเธ‡เธงเธฑเธฅเน„เธ”เน‰' USING ERRCODE = 'P0001';
    END IF;

    IF v_selected_item.type = 'empty' THEN
        v_public_value := 'เน„เธกเนˆเน„เธ”เน‰เธฃเธฑเธšเธฃเธฒเธ‡เธงเธฑเธฅ';
    ELSIF v_selected_item.type = 'coupon' THEN
        v_coupon_code := 'GACHA-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
        INSERT INTO public.coupons (code, discount, max_uses_per_user, is_active)
        VALUES (v_coupon_code || '#' || p_user_id::TEXT, v_selected_item.coupon_discount, 1, true);
        v_public_value := v_coupon_code;
    ELSIF v_selected_item.type = 'topup' THEN
        v_coupon_code := 'TOPUP-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
        INSERT INTO public.topup_codes (code, amount)
        VALUES (v_coupon_code, v_selected_item.topup_amount);
        v_public_value := v_coupon_code;
    ELSIF v_selected_item.type = 'code' THEN
        IF COALESCE(array_length(v_selected_item.stock, 1), 0) = 0 THEN
            RAISE EXCEPTION 'เธฃเธฒเธ‡เธงเธฑเธฅเน‚เธ„เน‰เธ”เธกเธตเธชเธ•เน‡เธญเธ เน„เธกเนˆเน€เธžเธตเธขเธ‡เธžเธญ' USING ERRCODE = 'P0001';
        END IF;
        v_code := v_selected_item.stock[1];
        UPDATE public.gacha_items
        SET stock = stock[2:array_length(stock, 1)]
        WHERE id = v_selected_item.id;
        INSERT INTO public.gacha_won_codes (gacha_item_id, code, won_by)
        VALUES (v_selected_item.id, v_code, p_user_id);
        v_public_value := v_code;
    END IF;

    UPDATE public.users
    SET balance = balance - v_tier.price,
        total_spent = COALESCE(total_spent, 0) + v_tier.price
    WHERE id = p_user_id
    RETURNING * INTO v_user;

    v_description := '[เธชเธธเนˆเธกเธงเธ‡เธฅเน‰เธญ Gacha: ' || v_tier.name || '] เธชเธธเนˆเธกเน„เธ”เน‰: ' || v_selected_item.name;
    IF v_selected_item.type <> 'empty' THEN
        v_description := v_description || chr(10) || v_public_value;
    END IF;
    INSERT INTO public.transactions (user_id, type, amount, description, status)
    VALUES (p_user_id, 'purchase', -v_tier.price, v_description, 'completed')
    RETURNING * INTO v_transaction;

    IF v_selected_item.type <> 'empty' THEN
        INSERT INTO public.gacha_logs (username, prize_name, tier_id, tier_name, tier_price)
        VALUES (v_user.username, v_selected_item.name, v_tier.id, v_tier.name, v_tier.price);
    END IF;

    RETURN jsonb_build_object(
        'itemId', v_selected_item.id,
        'prizeName', v_selected_item.name,
        'type', v_selected_item.type,
        'wonValue', v_public_value,
        'tierId', v_tier.id,
        'tierName', v_tier.name,
        'chargedPrice', v_tier.price,
        'newBalance', v_user.balance,
        'transactionId', v_transaction.id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) TO service_role;

COMMIT;

-- 13. Table: Site Settings
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read site_settings" ON public.site_settings;
CREATE POLICY "Allow public read site_settings" ON public.site_settings FOR SELECT USING (true);

INSERT INTO public.site_settings (key, value)
VALUES ('topup_config', '{
  "promptpay": {
    "enabled": true,
    "promptpayId": "004999038911094",
    "expectedName": "สมัชญ์"
  },
  "wallet": {
    "enabled": true
  },
  "cashcard": {
    "enabled": true,
    "feePercent": 15
  },
  "giftcode": {
    "enabled": true
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
