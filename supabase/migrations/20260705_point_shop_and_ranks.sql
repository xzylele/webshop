-- Upgrades the schema for Point Shop and VIP Ranks integration
BEGIN;

-- 1. Alter public.users to add points and last_rewarded_rank columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 CHECK (points >= 0);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_rewarded_rank TEXT DEFAULT 'Member';

-- 2. Create public.point_items table
CREATE TABLE IF NOT EXISTS public.point_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    point_cost INTEGER NOT NULL CHECK (point_cost > 0),
    image_url TEXT,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('credit', 'coupon', 'gacha_ticket', 'code')),
    reward_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    stock INTEGER NOT NULL DEFAULT -1, -- -1 means unlimited
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for point_items
ALTER TABLE public.point_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read point_items" ON public.point_items;
CREATE POLICY "Allow public read point_items" ON public.point_items FOR SELECT USING (true);

-- 3. Create public.point_transactions table
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
    amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for point_transactions
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create public.user_quests table
CREATE TABLE IF NOT EXISTS public.user_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quest_type TEXT NOT NULL CHECK (quest_type IN ('daily_checkin', 'daily_purchase', 'daily_gacha')),
    completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, quest_type, completed_date)
);

-- Enable RLS for user_quests
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;

-- 5. Create public.global_settings table for dynamic toggles (like X2 Event)
CREATE TABLE IF NOT EXISTS public.global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Enable RLS for global_settings
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read global_settings" ON public.global_settings;
CREATE POLICY "Allow public read global_settings" ON public.global_settings FOR SELECT USING (true);

-- Seed double points event to false
INSERT INTO public.global_settings (key, value)
VALUES ('double_points_event', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed Point Gacha Tier into public.gacha_tiers (with slug 'point')
INSERT INTO public.gacha_tiers (name, slug, price, sort_order)
VALUES ('Point Gacha (ใช้พอยท์สุ่ม)', 'point', 15, 5)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    price = EXCLUDED.price,
    sort_order = EXCLUDED.sort_order;

-- Seed Point Gacha items under Point Gacha tier
DO $$
DECLARE
    v_tier_id UUID;
BEGIN
    SELECT id INTO v_tier_id FROM public.gacha_tiers WHERE slug = 'point';
    
    IF v_tier_id IS NOT NULL THEN
        -- ลบไอเทมเก่าตู้ point ป้องกันความซ้ำซ้อนกรณีรันใหม่
        DELETE FROM public.gacha_items WHERE tier_id = v_tier_id;
        
        INSERT INTO public.gacha_items (tier_id, name, type, chance, topup_amount, coupon_discount)
        VALUES 
            (v_tier_id, 'เครดิตฟรี 5 บาท', 'topup', 30.00, 5, 0),
            (v_tier_id, 'เครดิตฟรี 10 บาท', 'topup', 15.00, 10, 0),
            (v_tier_id, 'คูปองส่วนลด 15 บาท', 'coupon', 25.00, 0, 15),
            (v_tier_id, 'เกลือ (ขอบคุณที่ร่วมสนุกจ้า)', 'empty', 30.00, 0, 0);
    END IF;
END;
$$;

-- Seed sample Point Shop items for demonstration
INSERT INTO public.point_items (name, description, point_cost, image_url, reward_type, reward_data, stock, is_active)
VALUES
    ('บัตรเติมเงินฟรี 50 บาท', 'เครดิตเข้าระบบNakaraShop ทันที 50 บาทสำหรับช้อปปิ้ง', 300, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=60', 'credit', '{"amount": 50}', 50, true),
    ('บัตรเติมเงินฟรี 100 บาท', 'เครดิตเข้าระบบNakaraShop ทันที 100 บาทสำหรับช้อปปิ้ง', 550, 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=60', 'credit', '{"amount": 100}', 25, true),
    ('คูปองส่วนลดพิเศษ 20 บาท', 'คูปองใช้ลดสินค้าในร้านค้าไม่มีขั้นต่ำ (อายุใช้งาน 30 วัน)', 100, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=60', 'coupon', '{"discount": 20}', 100, true),
    ('คีย์เกมสุ่ม Steam คีย์ปกติ', 'คีย์รหัสเกมสุ่มเปิดใช้งานใน Steam เพื่อรับเกมแท้ 1 เกม', 150, 'https://images.unsplash.com/photo-1580234810907-b40315b76418?w=300&auto=format&fit=crop&q=60', 'code', '{"codes": ["STEAM-GIFT-A1B2-C3D4", "STEAM-GIFT-E5F6-G7H8", "STEAM-GIFT-I9J0-K1L2"]}', 3, true)
ON CONFLICT DO NOTHING;


-- 6. Re-define public.spin_gacha function to handle points, rank up rewards, quests, and X2 multiplier
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
    
    -- Variables for Points & Rank system
    v_is_x2_active BOOLEAN := false;
    v_multiplier NUMERIC := 1.0;
    v_points_earned INTEGER := 0;
    v_base_points INTEGER := 0;
    v_old_rank TEXT;
    v_old_spent NUMERIC;
    v_new_spent NUMERIC;
    v_old_rank_idx INTEGER := 0;
    v_new_rank_idx INTEGER := 0;
    v_last_rewarded_rank_idx INTEGER := 0;
    v_promo_credit_reward INTEGER := 0;
    v_promo_point_reward INTEGER := 0;
    v_rank_up_info JSONB := NULL;
    v_idx INTEGER;
    v_today_str TEXT;
BEGIN
    -- 1. ล็อกและดึงข้อมูล User & Tier
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบข้อมูลผู้ใช้งาน' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_tier FROM public.gacha_tiers WHERE id = p_tier_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ไม่พบระดับกาชา' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_tier.is_active THEN
        RAISE EXCEPTION 'ระดับกาชานี้ปิดใช้งาน' USING ERRCODE = '23514';
    END IF;

    -- 2. ตรวจสอบเงื่อนไขการใช้จ่าย (แต้มสะสม หรือ เครดิตวอลเล็ต)
    IF v_tier.slug = 'point' THEN
        -- ใช้แต้มสุ่มกาชา
        IF v_user.points < v_tier.price::INTEGER THEN
            RAISE EXCEPTION 'แต้มสะสมคงเหลือไม่เพียงพอ (ต้องการ % แต้ม)' , v_tier.price::INTEGER USING ERRCODE = 'P0001';
        END IF;
    ELSE
        -- ใช้เงินเครดิตปกติสุ่มกาชา
        IF v_user.balance < v_tier.price THEN
            RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 3. ตรวจสอบเปอร์เซ็นต์ตู้
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

    -- 4. สุ่มสิทธิ์เลือกของรางวัล
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

    -- 5. ส่งมอบรางวัลตามประเภทไอเทม
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

    -- 6. การคิดแต้มสะสมและอัปยศ (เฉพาะเมื่อสุ่มด้วยเงินเครดิต ไม่ใช่ตู้ Point Gacha)
    v_old_spent := COALESCE(v_user.total_spent, 0);
    IF v_tier.slug <> 'point' THEN
        -- ตรวจสอบแคมเปญแต้มคูณสอง (X2)
        SELECT COALESCE((value ->> 'double_points_event')::BOOLEAN, (value)::TEXT = 'true', false) INTO v_is_x2_active 
        FROM public.global_settings WHERE key = 'double_points_event';

        -- คำนวณตัวคูณแต้มตามยศก่อนหน้า
        -- หายศย้อนหลังของยอดสะสมเก่า
        IF v_old_spent >= 50000 THEN v_old_rank := 'Platinum VIP';
        ELSIF v_old_spent >= 15000 THEN v_old_rank := 'Gold VIP';
        ELSIF v_old_spent >= 5000 THEN v_old_rank := 'Silver VIP';
        ELSIF v_old_spent >= 1000 THEN v_old_rank := 'Bronze VIP';
        ELSE v_old_rank := 'Member';
        END IF;

        IF v_old_rank = 'Bronze VIP' THEN v_multiplier := 1.1;
        ELSIF v_old_rank = 'Silver VIP' THEN v_multiplier := 1.2;
        ELSIF v_old_rank = 'Gold VIP' THEN v_multiplier := 1.3;
        ELSIF v_old_rank = 'Platinum VIP' THEN v_multiplier := 1.5;
        ELSE v_multiplier := 1.0;
        END IF;

        v_base_points := floor(v_tier.price / 10)::INTEGER;
        v_points_earned := floor(v_base_points * v_multiplier)::INTEGER;
        IF v_is_x2_active THEN
            v_points_earned := v_points_earned * 2;
        END IF;

        v_new_spent := v_old_spent + v_tier.price;
        v_user.balance := v_user.balance - v_tier.price;
        v_user.points := v_user.points + v_points_earned;
        
        -- บันทึกธุรกรรมพอยท์ที่ได้รับ
        IF v_points_earned > 0 THEN
            INSERT INTO public.point_transactions (user_id, type, amount, description)
            VALUES (p_user_id, 'earn', v_points_earned, 'ได้รับแต้มสุ่มกาชาตู้: ' || v_tier.name || ' (ตัวคูณยศ: ' || v_multiplier::TEXT || 'x' || CASE WHEN v_is_x2_active THEN ' x2 กิจกรรม' ELSE '' END || ')');
        END IF;
    ELSE
        -- หากสุ่มด้วยพอยท์ (Point Gacha)
        v_new_spent := v_old_spent;
        v_user.points := v_user.points - v_tier.price::INTEGER;
        
        -- บันทึกธุรกรรมหักแต้มสะสม
        INSERT INTO public.point_transactions (user_id, type, amount, description)
        VALUES (p_user_id, 'redeem', -v_tier.price::INTEGER, 'สุ่มตู้ Point Gacha (-' || v_tier.price::INTEGER || ' แต้ม)');
    END IF;

    -- 7. ระบบเลื่อนยศ Rank Level Up & โบนัส (เฉพาะเมื่อยอดสะสมจริงเปลี่ยน)
    IF v_new_spent <> v_old_spent THEN
        -- คำนวณยศใหม่
        v_old_rank_idx := CASE
            WHEN v_old_spent >= 50000 THEN 4
            WHEN v_old_spent >= 15000 THEN 3
            WHEN v_old_spent >= 5000  THEN 2
            WHEN v_old_spent >= 1000  THEN 1
            ELSE 0
        END;
        
        v_new_rank_idx := CASE
            WHEN v_new_spent >= 50000 THEN 4
            WHEN v_new_spent >= 15000 THEN 3
            WHEN v_new_spent >= 5000  THEN 2
            WHEN v_new_spent >= 1000  THEN 1
            ELSE 0
        END;

        v_last_rewarded_rank_idx := CASE 
            WHEN COALESCE(v_user.last_rewarded_rank, 'Member') = 'Platinum VIP' THEN 4
            WHEN COALESCE(v_user.last_rewarded_rank, 'Member') = 'Gold VIP' THEN 3
            WHEN COALESCE(v_user.last_rewarded_rank, 'Member') = 'Silver VIP' THEN 2
            WHEN COALESCE(v_user.last_rewarded_rank, 'Member') = 'Bronze VIP' THEN 1
            ELSE 0
        END;

        IF v_new_rank_idx > v_last_rewarded_rank_idx THEN
            FOR v_idx IN (v_last_rewarded_rank_idx + 1) .. v_new_rank_idx LOOP
                IF v_idx = 1 THEN v_promo_credit_reward := v_promo_credit_reward + 50; v_promo_point_reward := v_promo_point_reward + 100;
                ELSIF v_idx = 2 THEN v_promo_credit_reward := v_promo_credit_reward + 150; v_promo_point_reward := v_promo_point_reward + 300;
                ELSIF v_idx = 3 THEN v_promo_credit_reward := v_promo_credit_reward + 500; v_promo_point_reward := v_promo_point_reward + 1000;
                ELSIF v_idx = 4 THEN v_promo_credit_reward := v_promo_credit_reward + 1500; v_promo_point_reward := v_promo_point_reward + 3000;
                END IF;
            END LOOP;

            IF v_promo_credit_reward > 0 OR v_promo_point_reward > 0 THEN
                v_user.balance := v_user.balance + v_promo_credit_reward;
                v_user.points := v_user.points + v_promo_point_reward;
                v_user.last_rewarded_rank := CASE
                    WHEN v_new_rank_idx = 4 THEN 'Platinum VIP'
                    WHEN v_new_rank_idx = 3 THEN 'Gold VIP'
                    WHEN v_new_rank_idx = 2 THEN 'Silver VIP'
                    WHEN v_new_rank_idx = 1 THEN 'Bronze VIP'
                    ELSE 'Member'
                END;

                v_rank_up_info := jsonb_build_object(
                    'from', COALESCE(v_user.last_rewarded_rank, 'Member'),
                    'to', v_user.last_rewarded_rank,
                    'creditReward', v_promo_credit_reward,
                    'pointReward', v_promo_point_reward
                );

                -- บันทึกธุรกรรมรางวัลเครดิตเลื่อนยศ
                IF v_promo_credit_reward > 0 THEN
                    INSERT INTO public.transactions (user_id, type, amount, description, status)
                    VALUES (p_user_id, 'adjust', v_promo_credit_reward, 'รางวัลเลื่อนยศสมาชิกเป็น ' || v_user.last_rewarded_rank || ' 🎉 (+' || v_promo_credit_reward || ' THB)', 'completed');
                END IF;

                -- บันทึกธุรกรรมรางวัลพอยท์เลื่อนยศ
                IF v_promo_point_reward > 0 THEN
                    INSERT INTO public.point_transactions (user_id, type, amount, description)
                    VALUES (p_user_id, 'earn', v_promo_point_reward, 'โบนัสแต้มสะสมจากการเลื่อนยศเป็น ' || v_user.last_rewarded_rank || ' 🎉');
                END IF;
            END IF;
        END IF;
    END IF;

    -- 8. เซฟข้อมูล User ลง DB
    UPDATE public.users
    SET balance = v_user.balance,
        total_spent = v_new_spent,
        points = v_user.points,
        last_rewarded_rank = v_user.last_rewarded_rank
    WHERE id = p_user_id;

    -- 9. บันทึก Transaction การซื้อสินค้า/สุ่มกาชา
    v_description := '[สุ่มวงล้อ Gacha: ' || v_tier.name || '] สุ่มได้: ' || v_selected_item.name;
    IF v_selected_item.type <> 'empty' THEN
        v_description := v_description || chr(10) || v_public_value;
    END IF;

    IF v_tier.slug <> 'point' THEN
        INSERT INTO public.transactions (user_id, type, amount, description, status)
        VALUES (p_user_id, 'purchase', -v_tier.price, v_description, 'completed')
        RETURNING * INTO v_transaction;
    ELSE
        -- หากสุ่มด้วยพอยท์ช็อป (ไม่มีการหักเงิน) แต่บันทึกรายละเอียดประวัติสุ่มได้
        INSERT INTO public.transactions (user_id, type, amount, description, status)
        VALUES (p_user_id, 'purchase', 0, '[แลกพอยท์สุ่ม Point Gacha] ผลลัพธ์: ' || v_selected_item.name || chr(10) || v_public_value, 'completed')
        RETURNING * INTO v_transaction;
    END IF;

    -- 10. บันทึก Log กลาง
    IF v_selected_item.type <> 'empty' THEN
        INSERT INTO public.gacha_logs (username, prize_name, tier_id, tier_name, tier_price)
        VALUES (v_user.username, v_selected_item.name, v_tier.id, v_tier.name, v_tier.price);
    END IF;

    -- 11. บันทึกความคืบหน้าภารกิจสุ่มกาชารายวัน (Daily Gacha Quest)
    v_today_str := to_char(now(), 'YYYY-MM-DD');
    BEGIN
        INSERT INTO public.user_quests (user_id, quest_type, completed_date, is_claimed)
        VALUES (p_user_id, 'daily_gacha', v_today_str::DATE, false);
    EXCEPTION WHEN unique_violation THEN
        -- หากมีข้อมูลเควสของวันนี้อยู่แล้ว ให้ข้าม (บันทึกสำเร็จแล้ว)
    END;

    RETURN jsonb_build_object(
        'itemId', v_selected_item.id,
        'prizeName', v_selected_item.name,
        'type', v_selected_item.type,
        'wonValue', v_public_value,
        'tierId', v_tier.id,
        'tierName', v_tier.name,
        'chargedPrice', v_tier.price,
        'newBalance', v_user.balance,
        'newPoints', v_user.points,
        'transactionId', v_transaction.id,
        'rankUpInfo', v_rank_up_info
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.spin_gacha(UUID, UUID) TO service_role;

COMMIT;
