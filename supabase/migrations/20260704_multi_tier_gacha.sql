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
            ADD CONSTRAINT gacha_items_type_check CHECK (type IN ('empty', 'coupon', 'code'));
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
        RAISE EXCEPTION 'ไม่พบข้อมูลผู้ใช้งาน' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_tier
    FROM public.gacha_tiers
    WHERE id = p_tier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบระดับกาชา' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_tier.is_active THEN
        RAISE EXCEPTION 'ระดับกาชานี้ปิดใช้งาน' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(sum(round(chance * 100)), 0)::INTEGER
    INTO v_total_basis_points
    FROM public.gacha_items
    WHERE tier_id = p_tier_id;

    IF v_total_basis_points <> 10000 THEN
        RAISE EXCEPTION 'เปอร์เซ็นต์รางวัลต้องรวมครบ 100%%' USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.gacha_items
        WHERE tier_id = p_tier_id
          AND type = 'code'
          AND chance > 0
          AND COALESCE(array_length(stock, 1), 0) = 0
    ) THEN
        RAISE EXCEPTION 'รางวัลโค้ดมีสต็อกไม่เพียงพอ' USING ERRCODE = 'P0001';
    END IF;

    IF v_user.balance < v_tier.price THEN
        RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ' USING ERRCODE = 'P0001';
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
        RAISE EXCEPTION 'ไม่สามารถเลือกรางวัลได้' USING ERRCODE = 'P0001';
    END IF;

    IF v_selected_item.type = 'empty' THEN
        v_public_value := 'ไม่ได้รับรางวัล';
    ELSIF v_selected_item.type = 'coupon' THEN
        v_coupon_code := 'GACHA-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
        INSERT INTO public.coupons (code, discount, max_uses_per_user, is_active)
        VALUES (v_coupon_code || '#' || p_user_id::TEXT, v_selected_item.coupon_discount, 1, true);
        v_public_value := v_coupon_code;
    ELSIF v_selected_item.type = 'code' THEN
        IF COALESCE(array_length(v_selected_item.stock, 1), 0) = 0 THEN
            RAISE EXCEPTION 'รางวัลโค้ดมีสต็อกไม่เพียงพอ' USING ERRCODE = 'P0001';
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

    v_description := '[สุ่มวงล้อ Gacha: ' || v_tier.name || '] สุ่มได้: ' || v_selected_item.name;
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
