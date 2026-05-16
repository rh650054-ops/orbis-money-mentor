
CREATE TABLE public.defcon_daily_loadout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  qty_initial NUMERIC NOT NULL DEFAULT 0,
  qty_sold NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, product_id)
);

ALTER TABLE public.defcon_daily_loadout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own loadout" ON public.defcon_daily_loadout
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own loadout" ON public.defcon_daily_loadout
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own loadout" ON public.defcon_daily_loadout
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own loadout" ON public.defcon_daily_loadout
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_defcon_daily_loadout_updated_at
  BEFORE UPDATE ON public.defcon_daily_loadout
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_defcon_loadout_user_date ON public.defcon_daily_loadout(user_id, date);
