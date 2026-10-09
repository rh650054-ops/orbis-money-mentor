-- ============================================================
-- PRODUTOS & ESTOQUE — quiz de cadastro + estoque que fecha a conta — 09/10/2026
--
-- 1) products ganha o que o quiz pergunta:
--      origem            'compra' (compro pronto) | 'faz' (eu mesmo faço)
--      emoji             ícone do produto na lista e no Foco
--      controla_estoque  false = "não controlo estoque desse produto" (a carga
--                        do dia não limita e a venda não baixa estoque)
-- 2) A venda do Foco baixa o estoque NO BANCO, num gatilho só (defcon_sales):
--      estoque do produto, "Mercadoria de hoje", ingredientes da receita por
--      unidade, histórico (product_sales_log, com o VALOR REAL da venda — o
--      combo "3 por R$ 10" grava R$ 10, não 3 × preço unitário) e o custo da
--      mercadoria do dia (daily_sales.cost).
--    Apagar a venda desfaz tudo isso (bug: apagar não devolvia o produto).
--    Se um desses passos falhar, a venda NÃO cai: o passo vira aviso no log.
--    O dia é o da sessão do Foco (virada de meia-noite cai no dia certo).
--    Antes o app fazia isso no celular, em vários passos, e perdia baixas
--    quando duas vendas saíam juntas.
-- Idempotente, sem comandos de apagar dados.
-- ============================================================

alter table public.products
  add column if not exists origem text,
  add column if not exists emoji text,
  add column if not exists controla_estoque boolean not null default true;

do $$ begin
  alter table public.products add constraint products_origem_check
    check (origem is null or origem in ('compra', 'faz'));
exception when duplicate_object then null; end $$;

alter table public.product_sales_log
  add column if not exists defcon_sale_id uuid,
  add column if not exists unit_cost numeric;

create index if not exists product_sales_log_defcon_sale_idx
  on public.product_sales_log (defcon_sale_id) where defcon_sale_id is not null;

create or replace function public.defcon_venda_baixa_estoque()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_dia date;
  p record;
  v_custo numeric;
  v_log record;
  v_modo text;
  v_controla boolean;
begin
  if tg_op = 'INSERT' then
    if new.product_id is null or coalesce(new.qty, 0) <= 0 then return new; end if;

    select pr.id, pr.name, coalesce(pr.cost, 0) as cost, pr.recipe_mode,
           coalesce(pr.controla_estoque, true) as controla
      into p
      from public.products pr
     where pr.id = new.product_id and pr.user_id = new.user_id;
    if not found then return new; end if;

    v_dia := coalesce(
      (select cs.date from public.challenge_sessions cs where cs.id = new.session_id),
      (new.created_at at time zone 'America/Sao_Paulo')::date);

    -- Nada aqui pode derrubar a venda: se um passo falhar, a venda fica e o
    -- passo vira aviso no log (mesmo padrão de aplicar_compra_mercadoria).
    begin
      if p.controla then
        update public.products
           set stock_quantity = greatest(coalesce(stock_quantity, 0) - new.qty, 0)::int,
               updated_at = now()
         where id = new.product_id;
      end if;

      update public.defcon_daily_loadout
         set qty_sold = coalesce(qty_sold, 0) + new.qty, updated_at = now()
       where user_id = new.user_id and product_id = new.product_id and date = v_dia;
      if not found then
        insert into public.defcon_daily_loadout (user_id, date, product_id, product_name, qty_initial, qty_sold)
        values (new.user_id, v_dia, p.id, p.name, 0, new.qty)
        on conflict (user_id, date, product_id) do update
          set qty_sold = coalesce(defcon_daily_loadout.qty_sold, 0) + excluded.qty_sold;
      end if;

      if p.recipe_mode = 'per_unit' then
        update public.ingredients i
           set stock_quantity = greatest(coalesce(i.stock_quantity, 0) - r.quantity * new.qty, 0)
          from public.product_recipes r
         where r.product_id = new.product_id and i.id = r.ingredient_id and i.user_id = new.user_id;
      end if;

      insert into public.product_sales_log (user_id, product_id, quantity, total_amount, defcon_sale_id, unit_cost)
      values (new.user_id, new.product_id, new.qty, coalesce(new.amount, 0), new.id, p.cost);

      if p.cost > 0 then
        insert into public.daily_sales (user_id, date, cost)
        values (new.user_id, v_dia, round(p.cost * new.qty, 2))
        on conflict (user_id, date) do update
          set cost = round(coalesce(daily_sales.cost, 0) + excluded.cost, 2);
      end if;
    exception when others then
      raise warning 'defcon_venda_baixa_estoque (venda %): %', new.id, sqlerrm;
    end;
    return new;

  elsif tg_op = 'DELETE' then
    if old.product_id is null or coalesce(old.qty, 0) <= 0 then return old; end if;

    select pr.recipe_mode, coalesce(pr.controla_estoque, true)
      into v_modo, v_controla
      from public.products pr
     where pr.id = old.product_id and pr.user_id = old.user_id;

    v_dia := coalesce(
      (select cs.date from public.challenge_sessions cs where cs.id = old.session_id),
      (old.created_at at time zone 'America/Sao_Paulo')::date);

    begin
      if coalesce(v_controla, false) then
        update public.products
           set stock_quantity = (coalesce(stock_quantity, 0) + old.qty)::int, updated_at = now()
         where id = old.product_id;
      end if;

      update public.defcon_daily_loadout
         set qty_sold = greatest(coalesce(qty_sold, 0) - old.qty, 0), updated_at = now()
       where user_id = old.user_id and product_id = old.product_id and date = v_dia;

      if v_modo = 'per_unit' then
        update public.ingredients i
           set stock_quantity = coalesce(i.stock_quantity, 0) + r.quantity * old.qty
          from public.product_recipes r
         where r.product_id = old.product_id and i.id = r.ingredient_id and i.user_id = old.user_id;
      end if;

      select l.id, coalesce(l.unit_cost, 0) as unit_cost into v_log
        from public.product_sales_log l where l.defcon_sale_id = old.id limit 1;
      if found then
        delete from public.product_sales_log where id = v_log.id;
        v_custo := round(v_log.unit_cost * old.qty, 2);
        if v_custo > 0 then
          update public.daily_sales
             set cost = greatest(round(coalesce(cost, 0) - v_custo, 2), 0)
           where user_id = old.user_id and date = v_dia;
        end if;
      end if;
    exception when others then
      raise warning 'defcon_venda_baixa_estoque (apagar %): %', old.id, sqlerrm;
    end;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists defcon_venda_estoque on public.defcon_sales;
create trigger defcon_venda_estoque
  after insert or delete on public.defcon_sales
  for each row execute function public.defcon_venda_baixa_estoque();
