-- ============================================================
-- COMO O INGREDIENTE É COMPRADO (Rick, 13/10/2026)
-- "Canudo eu compro pacote de 100, maracujá uns 15, leite em pó lata de 800 g —
--  não dá pra pôr preço de 1." Agora cada ingrediente guarda:
--   • unit        — em que ele mede o que vai na receita (un, g, kg, ml, l);
--   • pacote_qtd  — quanto vem em cada compra (pacote de 100 un, lata de 800 g).
-- O custo continua por unidade de medida (cost_per_unit = preço do pacote ÷ pacote_qtd),
-- então mercado_concluir, receita e custo do produto não mudam. O "Tô no mercado"
-- passa a contar em pacotes e converte (2 pacotes de 100 = 200 canudos).
-- Só acrescenta: nenhuma linha é apagada.
-- ============================================================

alter table public.ingredients add column if not exists pacote_qtd numeric not null default 1;

do $$ begin
  alter table public.ingredients add constraint ingredients_pacote_qtd_positivo check (pacote_qtd > 0);
exception when duplicate_object then null; end $$;

-- itens: [{ nome, unidade, pacote }] — acha o ingrediente do usuário pelo nome.
create or replace function public.ingredientes_definir_compra(p_itens jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  it jsonb;
  v_un text; v_pac numeric; v_n integer := 0; v_k integer;
begin
  if u is null then raise exception 'login necessario'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 40 then
    raise exception 'itens invalidos';
  end if;
  for it in select value from jsonb_array_elements(p_itens) loop
    v_un := lower(coalesce(it->>'unidade', 'un'));
    if v_un not in ('un', 'g', 'kg', 'ml', 'l') then v_un := 'un'; end if;
    v_pac := coalesce(nullif(it->>'pacote', '')::numeric, 1);
    if v_pac <= 0 or v_pac > 1000000 then v_pac := 1; end if;
    update public.ingredients
       set unit = v_un, pacote_qtd = v_pac, updated_at = now()
     where user_id = u and lower(trim(name)) = lower(trim(coalesce(it->>'nome', '')));
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  return v_n;
end $$;

revoke all on function public.ingredientes_definir_compra(jsonb) from public, anon;
grant execute on function public.ingredientes_definir_compra(jsonb) to authenticated;
