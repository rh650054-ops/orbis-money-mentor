
-- 1. Ingredients (mercadoria/insumos)
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un', -- un, g, kg, ml, l, pct
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  stock_min NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingredients_user ON public.ingredients(user_id);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own ingredients" ON public.ingredients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ingredients" ON public.ingredients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ingredients" ON public.ingredients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ingredients" ON public.ingredients FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Product recipes (link product <-> ingredient with quantity)
CREATE TABLE public.product_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0, -- per unit sold (per_unit mode) OR per batch (batch mode)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, ingredient_id)
);
CREATE INDEX idx_recipes_product ON public.product_recipes(product_id);
CREATE INDEX idx_recipes_user ON public.product_recipes(user_id);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own recipes" ON public.product_recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recipes" ON public.product_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recipes" ON public.product_recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recipes" ON public.product_recipes FOR DELETE USING (auth.uid() = user_id);

-- 3. Production batches (modo "por lote")
CREATE TABLE public.production_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  batches_count NUMERIC NOT NULL DEFAULT 1, -- quantos lotes produziu
  units_produced NUMERIC NOT NULL DEFAULT 0, -- total de unidades adicionadas ao estoque
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prod_batches_user ON public.production_batches(user_id);

ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own batches" ON public.production_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own batches" ON public.production_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own batches" ON public.production_batches FOR DELETE USING (auth.uid() = user_id);

-- 4. Product sales log (cada venda registrada para baixar estoque)
CREATE TABLE public.product_sales_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_log_user ON public.product_sales_log(user_id);

ALTER TABLE public.product_sales_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own sales log" ON public.product_sales_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sales log" ON public.product_sales_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sales log" ON public.product_sales_log FOR DELETE USING (auth.uid() = user_id);

-- 5. Update products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recipe_mode TEXT NOT NULL DEFAULT 'none', -- 'none' | 'per_unit' | 'batch'
  ADD COLUMN IF NOT EXISTS batch_yield NUMERIC NOT NULL DEFAULT 0,    -- quantas unidades sai por lote
  ADD COLUMN IF NOT EXISTS low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
