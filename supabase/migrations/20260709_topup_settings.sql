-- Migration: Create site_settings table and seed topup configuration
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to site_settings
DROP POLICY IF EXISTS "Allow public read site_settings" ON public.site_settings;
CREATE POLICY "Allow public read site_settings" 
ON public.site_settings 
FOR SELECT 
USING (true);

-- Seed initial topup configurations
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
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
