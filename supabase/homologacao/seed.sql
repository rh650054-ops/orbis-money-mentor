-- Fictitious data for the STAGING project (23/11/2026). No real person, document, bank or integration.
-- It refuses to run anywhere that is not marked as staging:
--   * the marker table public.ambiente_homologacao must exist (created by hand, checklist step 6);
--   * the database must have fewer than 20 profiles (production has hundreds).
-- The 3 users are created by Rick in the Supabase panel (Authentication → Add user, auto confirm),
-- so no password ever lives in the repo. Re-running the seed is harmless (it skips what exists).
--   faz@vant-homologacao.test      makes products (recipes, flavours, a draft recipe)
--   revenda@vant-homologacao.test  buys ready to resell (no recipe)
--   novo@vant-homologacao.test     new account with no product (sees the dashboard banner)
begin;
do $$
begin
  if to_regclass('public.ambiente_homologacao') is null then
    raise exception 'Este banco não está marcado como homologação. Seed recusado.';
  end if;
  if (select count(*) from public.profiles) >= 20 then
    raise exception 'Este banco tem perfis demais para ser a homologação. Seed recusado.';
  end if;
end $$;

do $$
declare
  faz uuid := (select id from auth.users where email = 'faz@vant-homologacao.test');
  revenda uuid := (select id from auth.users where email = 'revenda@vant-homologacao.test');
  novo uuid := (select id from auth.users where email = 'novo@vant-homologacao.test');
  lc uuid; choc uuid; leite uuid; polpa uuid; acai uuid; copo uuid; p uuid; v uuid;
begin
  if faz is null or revenda is null or novo is null then
    raise exception 'Crie antes os 3 usuários fictícios no painel (faz@, revenda@, novo@vant-homologacao.test).';
  end if;

  insert into public.profiles (user_id, nickname)
  select x.u, x.n from (values (faz, 'Vendedor Faz'), (revenda, 'Vendedor Revenda'), (novo, 'Vendedor Novo')) as x(u, n)
   where not exists (select 1 from public.profiles pr where pr.user_id = x.u);
  -- the maker account can be reset to zero (conta_teste_zerar) to rehearse from scratch
  insert into public.contas_teste (user_id) select faz where not exists (select 1 from public.contas_teste where user_id = faz);

  if exists (select 1 from public.products where user_id = faz) then return; end if;   -- already seeded

  -- shared ingredients (one row each, used by several recipes and flavours)
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Leite condensado', 'un', 12, 6.49, 1) returning id into lc;
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Chocolate em pó', 'g', 2000, 0.03599, 1000) returning id into choc;          -- R$ 35,99 / kg
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Leite', 'ml', 6000, 0.0045, 1000) returning id into leite;
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Polpa de maracujá', 'g', 3000, 0.018, 1000) returning id into polpa;
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Açaí', 'g', 25000, 0.005196, 25000) returning id into acai;                 -- R$ 129,90 / 25 kg
  insert into public.ingredients (user_id, name, unit, stock_quantity, cost_per_unit, pacote_qtd) values
    (faz, 'Copo e canudo', 'un', 300, 0.12, 100) returning id into copo;

  -- 1) brigadeiro: complete recipe, no flavours
  insert into public.products (user_id, name, emoji, origem, recipe_mode, batch_yield, sale_price, stock_quantity)
  values (faz, 'Brigadeiro', '🍫', 'faz', 'batch', 30, 2.5, 0) returning id into p;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (faz, p, lc, 1), (faz, p, choc, 50);

  -- 2) batida: base recipe + flavour extras (today's model)
  insert into public.products (user_id, name, emoji, origem, recipe_mode, batch_yield, sale_price, stock_quantity)
  values (faz, 'Batida', '🥤', 'faz', 'batch', 20, 8, 0) returning id into p;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity) values (faz, p, leite, 1000), (faz, p, copo, 20);
  insert into public.product_variants (user_id, product_id, name, emoji, posicao) values (faz, p, 'Maracujá', '🥭', 0) returning id into v;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (faz, p, polpa, 400, v);
  insert into public.product_variants (user_id, product_id, name, emoji, posicao) values (faz, p, 'Açaí', '🫐', 1) returning id into v;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, variant_id) values (faz, p, acai, 500, v);

  -- 3) trufa: draft recipe (an ingredient still without quantity) — must NOT release production
  insert into public.products (user_id, name, emoji, origem, recipe_mode, batch_yield, sale_price, stock_quantity)
  values (faz, 'Trufa', '🍬', 'faz', 'batch', 15, 4, 0) returning id into p;
  insert into public.product_recipes (user_id, product_id, ingredient_id, quantity, aprender) values (faz, p, lc, 1, false), (faz, p, choc, 0, true);

  -- 4) made by the seller, sheet never filled in (one of the "104 without recipe")
  insert into public.products (user_id, name, emoji, origem, recipe_mode, sale_price) values (faz, 'Bolo de pote', '🍰', 'faz', 'none', 9);

  -- resale account: bought ready, no recipe; stock comes from purchases
  insert into public.products (user_id, name, emoji, origem, recipe_mode, cost, sale_price, stock_quantity) values
    (revenda, 'Água 500 ml', '💧', 'compra', 'none', 1.2, 3, 48),
    (revenda, 'Bala de goma', '🍬', 'compra', 'none', 0.35, 1, 200);
end $$;
commit;
