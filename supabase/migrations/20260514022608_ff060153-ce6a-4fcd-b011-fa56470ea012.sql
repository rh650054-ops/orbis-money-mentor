CREATE TABLE public.defcon_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'dinheiro',
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.defcon_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own defcon_clients" ON public.defcon_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own defcon_clients" ON public.defcon_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own defcon_clients" ON public.defcon_clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own defcon_clients" ON public.defcon_clients FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_defcon_clients_user_date ON public.defcon_clients(user_id, date DESC);