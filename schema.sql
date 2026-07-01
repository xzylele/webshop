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
    action_text TEXT DEFAULT 'ดูสินค้าทั้งหมด',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for Banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Create policies for Banners
CREATE POLICY "Allow public read banners" 
ON public.banners 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all for service_role on banners" 
ON public.banners 
FOR ALL 
USING (true);


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

CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on users" ON public.users FOR ALL USING (true);


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

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on products" ON public.products FOR ALL USING (true);


-- 4. Table: Product Codes (For digital keys stock)
CREATE TABLE IF NOT EXISTS public.product_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read product_codes" ON public.product_codes FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on product_codes" ON public.product_codes FOR ALL USING (true);


-- 5. Table: Transactions
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

CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on transactions" ON public.transactions FOR ALL USING (true);


-- 6. Table: Coupons
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

CREATE POLICY "Allow public read coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on coupons" ON public.coupons FOR ALL USING (true);


-- 7. Table: Gacha Items
CREATE TABLE IF NOT EXISTS public.gacha_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'empty' | 'coupon' | 'code'
    chance NUMERIC DEFAULT 10,
    coupon_discount NUMERIC DEFAULT 0,
    stock TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gacha_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read gacha_items" ON public.gacha_items FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on gacha_items" ON public.gacha_items FOR ALL USING (true);


-- 8. Table: Gacha Won Codes
CREATE TABLE IF NOT EXISTS public.gacha_won_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gacha_item_id UUID REFERENCES public.gacha_items(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    won_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    won_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gacha_won_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read gacha_won_codes" ON public.gacha_won_codes FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on gacha_won_codes" ON public.gacha_won_codes FOR ALL USING (true);


-- 9. Table: Gacha Logs
CREATE TABLE IF NOT EXISTS public.gacha_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT,
    prize_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gacha_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read gacha_logs" ON public.gacha_logs FOR SELECT USING (true);
CREATE POLICY "Allow all for service_role on gacha_logs" ON public.gacha_logs FOR ALL USING (true);


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

CREATE POLICY "Allow users to read their own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Allow users to insert their own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow all for service_role on support_tickets" ON public.support_tickets FOR ALL USING (true);


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

CREATE POLICY "Allow users to read messages of their own tickets" ON public.support_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')));
CREATE POLICY "Allow users to insert replies in their own tickets" ON public.support_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')));
CREATE POLICY "Allow all for service_role on support_messages" ON public.support_messages FOR ALL USING (true);


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

CREATE POLICY "Allow all for service_role on admin_notifications" ON public.admin_notifications FOR ALL USING (true);
