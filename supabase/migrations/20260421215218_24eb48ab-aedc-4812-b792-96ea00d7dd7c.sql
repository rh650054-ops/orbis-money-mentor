
-- 1. Tabela de contas Pix (múltiplos bancos para gerar QR)
CREATE TABLE public.pix_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL DEFAULT 'cpf',
  merchant_name TEXT NOT NULL,
  merchant_city TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pix accounts" ON public.pix_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own pix accounts" ON public.pix_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pix accounts" ON public.pix_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pix accounts" ON public.pix_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_pix_accounts_user ON public.pix_accounts(user_id);

CREATE TRIGGER update_pix_accounts_updated_at
  BEFORE UPDATE ON public.pix_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Adicionar campos no products: preço aberto + conta Pix vinculada
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS open_price BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_account_id UUID REFERENCES public.pix_accounts(id) ON DELETE SET NULL;
