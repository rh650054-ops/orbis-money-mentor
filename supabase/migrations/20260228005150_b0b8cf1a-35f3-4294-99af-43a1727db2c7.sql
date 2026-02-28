
-- Create subscriptions table for Hotmart integration
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'hotmart',
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz,
  grace_until timestamptz,
  hotmart_subscription_id text,
  hotmart_purchase_id text,
  last_event_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One subscription per user
CREATE UNIQUE INDEX idx_subscriptions_user_id ON public.subscriptions (user_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own subscription
CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all (for webhook)
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add unlinked_purchases table for purchases that couldn't be matched to a user
CREATE TABLE public.unlinked_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text,
  buyer_cpf text,
  hotmart_purchase_id text,
  hotmart_subscription_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_at timestamptz,
  linked_to_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unlinked_purchases ENABLE ROW LEVEL SECURITY;

-- Only service role can manage unlinked purchases
CREATE POLICY "Service role manages unlinked purchases" ON public.unlinked_purchases
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their linked purchases
CREATE POLICY "Users can view their linked purchases" ON public.unlinked_purchases
  FOR SELECT USING (auth.uid() = linked_to_user_id);
