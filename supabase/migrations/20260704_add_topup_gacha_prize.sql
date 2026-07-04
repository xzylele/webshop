-- Upgrades the schema for topup code prizes in Gacha
BEGIN;

-- 1. Alter gacha_items type CHECK constraint to include 'topup'
ALTER TABLE public.gacha_items DROP CONSTRAINT IF EXISTS gacha_items_type_check;
ALTER TABLE public.gacha_items ADD CONSTRAINT gacha_items_type_check CHECK (type IN ('empty', 'coupon', 'code', 'topup'));

-- 2. Add topup_amount column to gacha_items
ALTER TABLE public.gacha_items ADD COLUMN IF NOT EXISTS topup_amount NUMERIC DEFAULT 0;

-- 3. Create topup_codes table to store generated codes
CREATE TABLE IF NOT EXISTS public.topup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for topup_codes
ALTER TABLE public.topup_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role on topup_codes" ON public.topup_codes;

-- 4. Re-define spin_gacha function to handle 'topup' prize type
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
    ELSIF v_selected_item.type = 'topup' THEN
        v_coupon_code := 'TOPUP-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));
        INSERT INTO public.topup_codes (code, amount)
        VALUES (v_coupon_code, v_selected_item.topup_amount);
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
