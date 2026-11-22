-- Etapa 1 (22/11/2026) — production integrity.
--
-- Adds three NEW entry points, used by no screen yet:
--   producao_registrar(chave, itens, consumo?, notas?)   one atomic production of several products/flavours
--   producao_corrigir(registro, chave, itens, consumo?, motivo)
--   producao_desfazer(registro, chave, motivo)
--
-- What this file does NOT touch: produto_produzir, produto_produzir_sabores, registrar_producao,
-- mercado_* (including the automatic production after a purchase), production_batches, sales,
-- costs/margins, Open Finance, existing rows. Nothing existing is altered or removed.
--
-- Rules (the audit of 22/11 found the old functions break all of them):
--   * all or nothing: every product, flavour and ingredient of one call moves in one transaction;
--   * an ingredient never goes below zero: missing stock blocks the call with a specific message
--     (the old functions clamp with greatest(..., 0) and silently lose the difference);
--   * idempotency key: the same key with the same content returns the stored answer, even after
--     the client lost the first response; the same key with other content is refused;
--   * the REAL consumption of each production is stored and never edited; corrections and undos
--     are new events computed from that stored consumption (not from today's recipe);
--   * a correction/undo can never take out units that are no longer in stock (already sold).
--
-- Locks: products, then flavours, then ingredients, each in id order (FOR UPDATE), the same order
-- produto_produzir* start with. The idempotency key also takes a transaction advisory lock.

-- ------------------------------------------------------------------ tables (history, append-only)
create table public.producao_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'ativa' check (status in ('ativa', 'corrigida', 'desfeita')),
  versao integer not null default 1 check (versao >= 1),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index producao_registros_user_idx on public.producao_registros (user_id, criado_em desc);

-- One row per call that changed stock. The key is unique per user: the idempotency backstop.
create table public.producao_eventos (
  id uuid primary key,
  registro_id uuid not null references public.producao_registros (id) on delete cascade,
  user_id uuid not null,
  tipo text not null check (tipo in ('registro', 'correcao', 'desfazer')),
  versao integer not null check (versao >= 1),
  chave text not null check (char_length(chave) between 8 and 100),
  conteudo_hash text not null,
  motivo text check (motivo is null or char_length(motivo) <= 300),
  notas text check (notas is null or char_length(notas) <= 300),
  resposta jsonb not null,
  criado_em timestamptz not null default now(),
  unique (user_id, chave),
  unique (registro_id, versao)
);

-- What a version produced. No FK to products/variants on purpose: deleting a product must keep
-- working exactly as today, and the history keeps the names it had.
create table public.producao_itens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.producao_eventos (id) on delete cascade deferrable initially deferred,
  registro_id uuid not null references public.producao_registros (id) on delete cascade,
  user_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  produto_nome text not null,
  sabor_nome text,
  unidades integer not null check (unidades > 0)
);
create index producao_itens_evento_idx on public.producao_itens (evento_id);

-- What a version really consumed. quantidade_receita = what the recipe said at that moment;
-- quantidade_real = what left the stock (the recipe, or the amount the seller typed).
create table public.producao_consumos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.producao_eventos (id) on delete cascade deferrable initially deferred,
  registro_id uuid not null references public.producao_registros (id) on delete cascade,
  user_id uuid not null,
  ingredient_id uuid not null,
  ingrediente_nome text not null,
  unidade text,
  quantidade_receita numeric not null check (quantidade_receita >= 0),
  quantidade_real numeric not null check (quantidade_real >= 0),
  custo_unitario numeric  -- snapshot for history only; no cost or margin reads it
);
create index producao_consumos_evento_idx on public.producao_consumos (evento_id);

-- Ledger: every stock change, with the value before and after. Per registro, the deltas add up to
-- the current version's effect (zero after an undo).
create table public.producao_movimentos (
  id bigint generated always as identity primary key,
  evento_id uuid not null references public.producao_eventos (id) on delete cascade deferrable initially deferred,
  registro_id uuid not null references public.producao_registros (id) on delete cascade,
  user_id uuid not null,
  alvo text not null check (alvo in ('produto', 'sabor', 'ingrediente')),
  alvo_id uuid not null,
  delta numeric not null check (delta <> 0),
  antes numeric not null,
  depois numeric not null,
  criado_em timestamptz not null default now()
);
create index producao_movimentos_registro_idx on public.producao_movimentos (registro_id);

-- ------------------------------------------------------------------ immutability
-- History never changes. Two exceptions, both deletes of a whole account:
-- apagar_dados_do_usuario (delete-my-account) and the service role (admin-delete-user).
create or replace function public.producao_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare v_ctx text;
begin
  if tg_op = 'DELETE' then
    get diagnostics v_ctx = pg_context;
    if current_user = 'service_role' or v_ctx ~ 'apagar_dados_do_usuario' then return old; end if;
    -- the FK cascade from an allowed registro delete runs as the table owner, not as the caller;
    -- the parent row already passed this check
    if v_ctx ~ 'DELETE FROM ONLY "public"."producao_(eventos|itens|consumos|movimentos)"' and pg_trigger_depth() > 1 then return old; end if;
  elsif tg_op = 'UPDATE' and tg_table_name = 'producao_registros' then
    if new.id = old.id and new.user_id = old.user_id and new.criado_em = old.criado_em
       and new.versao = old.versao + 1 and old.status <> 'desfeita' then
      return new;
    end if;
  end if;
  raise exception 'O histórico de produção não pode ser alterado nem apagado.' using hint = 'VANT_HISTORICO_IMUTAVEL';
end $$;

create trigger producao_registros_imutavel before update or delete on public.producao_registros for each row execute function public.producao_imutavel();
create trigger producao_eventos_imutavel before update or delete on public.producao_eventos for each row execute function public.producao_imutavel();
create trigger producao_itens_imutavel before update or delete on public.producao_itens for each row execute function public.producao_imutavel();
create trigger producao_consumos_imutavel before update or delete on public.producao_consumos for each row execute function public.producao_imutavel();
create trigger producao_movimentos_imutavel before update or delete on public.producao_movimentos for each row execute function public.producao_imutavel();

create or replace function public.producao_sem_truncate() returns trigger language plpgsql as $$
begin
  raise exception 'O histórico de produção não pode ser apagado.' using hint = 'VANT_HISTORICO_IMUTAVEL';
end $$;
create trigger producao_registros_sem_truncate before truncate on public.producao_registros for each statement execute function public.producao_sem_truncate();
create trigger producao_eventos_sem_truncate before truncate on public.producao_eventos for each statement execute function public.producao_sem_truncate();
create trigger producao_itens_sem_truncate before truncate on public.producao_itens for each statement execute function public.producao_sem_truncate();
create trigger producao_consumos_sem_truncate before truncate on public.producao_consumos for each statement execute function public.producao_sem_truncate();
create trigger producao_movimentos_sem_truncate before truncate on public.producao_movimentos for each statement execute function public.producao_sem_truncate();

-- ------------------------------------------------------------------ access
-- Read-only for the owner; every write goes through the functions below.
alter table public.producao_registros enable row level security;
alter table public.producao_eventos enable row level security;
alter table public.producao_itens enable row level security;
alter table public.producao_consumos enable row level security;
alter table public.producao_movimentos enable row level security;
revoke all on public.producao_registros, public.producao_eventos, public.producao_itens, public.producao_consumos, public.producao_movimentos from public, anon, authenticated;
grant select on public.producao_registros, public.producao_eventos, public.producao_itens, public.producao_consumos, public.producao_movimentos to authenticated;
create policy producao_registros_dono on public.producao_registros for select to authenticated using (user_id = auth.uid());
create policy producao_eventos_dono on public.producao_eventos for select to authenticated using (user_id = auth.uid());
create policy producao_itens_dono on public.producao_itens for select to authenticated using (user_id = auth.uid());
create policy producao_consumos_dono on public.producao_consumos for select to authenticated using (user_id = auth.uid());
create policy producao_movimentos_dono on public.producao_movimentos for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ helpers (not callable by the app)
-- 1.5 -> '1,5', 2 -> '2' (pt-BR numbers in messages).
create or replace function public.producao_num(p numeric) returns text
language sql immutable set search_path = public as $$
  select replace(trim(trailing '.' from trim(trailing '0' from round(p, 3)::text)), '.', ',')
$$;

create or replace function public.producao_validar_chave(p_chave text) returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_chave is null or p_chave !~ '^[A-Za-z0-9:._-]{8,100}$' then
    raise exception 'Envio sem identificação válida. Atualize o app e tente de novo.' using hint = 'VANT_CHAVE_INVALIDA';
  end if;
end $$;

-- Same key: same content -> the stored answer (repetido = true); other content -> refused.
create or replace function public.producao_repetido(p_user uuid, p_chave text, p_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e record;
begin
  select conteudo_hash, resposta into e from public.producao_eventos where user_id = p_user and chave = p_chave;
  if not found then return null; end if;
  if e.conteudo_hash <> p_hash then
    raise exception 'Esse envio já foi usado com outro conteúdo. Comece de novo.' using hint = 'VANT_CHAVE_CONFLITO';
  end if;
  return e.resposta || jsonb_build_object('repetido', true);
end $$;

-- Validates the request and computes the target state:
--   {itens: [{produto, sabor, unidades, produto_nome, sabor_nome}],
--    consumo: [{ingrediente, nome, unidade, receita, real, custo}], avisos: [text]}
-- Consumption follows produto_produzir_sabores exactly: base recipe x (total units / batch_yield) plus
-- each flavour's extras x (flavour units / batch_yield). Products in 'per_unit' mode take their
-- ingredients at the sale (defcon_venda_baixa_estoque), so production takes none, as today.
-- p_consumo = [{ingrediente, quantidade}] replaces the recipe amount of that ingredient (real use).
create or replace function public.producao_estado_alvo(p_user uuid, p_itens jsonb, p_consumo jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  it jsonb; v_pid uuid; v_vid uuid; v_n numeric; v_iid uuid;
  v_itens jsonb := '[]'; v_ovr jsonb := '[]'; v_res jsonb;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos um produto para produzir.' using hint = 'VANT_ITENS_INVALIDOS';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Máximo de 100 itens por produção.' using hint = 'VANT_ITENS_INVALIDOS';
  end if;

  for it in select value from jsonb_array_elements(p_itens) loop
    begin v_pid := (it->>'produto')::uuid; exception when others then v_pid := null; end;
    if v_pid is null or not exists (select 1 from public.products p where p.id = v_pid and p.user_id = p_user) then
      raise exception 'Produto não encontrado.' using hint = 'VANT_PRODUTO_INVALIDO';
    end if;
    v_vid := null;
    if nullif(it->>'sabor', '') is not null then
      begin v_vid := (it->>'sabor')::uuid; exception when others then v_vid := null; end;
      if v_vid is null or not exists (select 1 from public.product_variants v where v.id = v_vid and v.product_id = v_pid and v.user_id = p_user) then
        raise exception 'Sabor não encontrado neste produto.' using hint = 'VANT_SABOR_INVALIDO';
      end if;
    end if;
    v_n := case when jsonb_typeof(it->'unidades') = 'number' then (it->>'unidades')::numeric end;
    if v_n is null or v_n <> trunc(v_n) or v_n < 1 or v_n > 1000000 then
      raise exception 'Quantidade inválida: use um número inteiro de 1 a 1.000.000.' using hint = 'VANT_UNIDADES_INVALIDAS';
    end if;
    v_itens := v_itens || jsonb_build_object('produto', v_pid, 'sabor', v_vid, 'unidades', v_n::int);
  end loop;

  if p_consumo is not null and jsonb_typeof(p_consumo) <> 'null' then
    if jsonb_typeof(p_consumo) <> 'array' then
      raise exception 'Consumo informado inválido.' using hint = 'VANT_CONSUMO_INVALIDO';
    end if;
    for it in select value from jsonb_array_elements(p_consumo) loop
      begin v_iid := (it->>'ingrediente')::uuid; exception when others then v_iid := null; end;
      if v_iid is null or not exists (select 1 from public.ingredients g where g.id = v_iid and g.user_id = p_user) then
        raise exception 'Ingrediente não encontrado.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      v_n := case when jsonb_typeof(it->'quantidade') = 'number' then (it->>'quantidade')::numeric end;
      if v_n is null or v_n < 0 or v_n > 1000000 then
        raise exception 'Quantidade de ingrediente inválida.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      if exists (select 1 from jsonb_array_elements(v_ovr) o where (o->>'ingrediente')::uuid = v_iid) then
        raise exception 'Ingrediente repetido no consumo informado.' using hint = 'VANT_CONSUMO_INVALIDO';
      end if;
      v_ovr := v_ovr || jsonb_build_object('ingrediente', v_iid, 'quantidade', v_n);
    end loop;
  end if;

  with itens as (
    select x.produto, x.sabor, sum(x.unidades)::int as unidades
      from jsonb_to_recordset(v_itens) as x(produto uuid, sabor uuid, unidades int) group by 1, 2
  ), prod as (
    select i.produto, sum(i.unidades)::numeric as u from itens i group by 1
  ), receita as (
    select r.ingredient_id, pr.u / p.batch_yield * r.quantity as q
      from prod pr join public.products p on p.id = pr.produto
      join public.product_recipes r on r.product_id = p.id and r.variant_id is null and r.quantity > 0
     where p.recipe_mode <> 'per_unit' and p.batch_yield > 0
    union all
    select r.ingredient_id, i.unidades / p.batch_yield * r.quantity
      from itens i join public.products p on p.id = i.produto
      join public.product_recipes r on r.variant_id = i.sabor and r.quantity > 0
     where i.sabor is not null and p.recipe_mode <> 'per_unit' and p.batch_yield > 0
  ), rec as (
    select ingredient_id, trim_scale(round(sum(q), 6)) as q from receita group by 1
  ), ovr as (
    select x.ingrediente, x.quantidade from jsonb_to_recordset(v_ovr) as x(ingrediente uuid, quantidade numeric)
  ), cons as (
    select coalesce(rec.ingredient_id, ovr.ingrediente) as id, coalesce(rec.q, 0) as receita, coalesce(ovr.quantidade, rec.q) as real
      from rec full join ovr on ovr.ingrediente = rec.ingredient_id
  )
  select jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('produto', i.produto, 'sabor', i.sabor, 'unidades', i.unidades,
                       'produto_nome', p.name, 'sabor_nome', v.name) order by p.name, v.posicao, v.name), '[]')
                from itens i join public.products p on p.id = i.produto left join public.product_variants v on v.id = i.sabor),
    'consumo', (select coalesce(jsonb_agg(jsonb_build_object('ingrediente', c.id, 'nome', g.name, 'unidade', g.unit,
                       'receita', c.receita, 'real', c.real, 'custo', g.cost_per_unit) order by g.name), '[]')
                  from cons c join public.ingredients g on g.id = c.id and g.user_id = p_user
                 where c.real > 0 or c.receita > 0),
    'avisos', (select coalesce(jsonb_agg(distinct a.txt), '[]') from (
                 select p.name || ': baixa os ingredientes na venda, não na produção.' as txt
                   from prod pr join public.products p on p.id = pr.produto
                  where p.recipe_mode = 'per_unit' and exists (select 1 from public.product_recipes r where r.product_id = p.id and r.quantity > 0)
                 union all
                 select p.name || ': receita sem rendimento por leva, nenhum ingrediente baixado.'
                   from prod pr join public.products p on p.id = pr.produto
                  where p.recipe_mode <> 'per_unit' and coalesce(p.batch_yield, 0) <= 0
                    and exists (select 1 from public.product_recipes r where r.product_id = p.id and r.quantity > 0)) a))
    into v_res;
  return v_res;
end $$;

-- The state a registro is in now (its latest version). Undone = nothing.
create or replace function public.producao_estado_atual(p_registro uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.id from public.producao_eventos e join public.producao_registros r on r.id = e.registro_id
     where e.registro_id = p_registro and e.versao = r.versao
  )
  select jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('produto', i.product_id, 'sabor', i.variant_id, 'unidades', i.unidades,
                     'produto_nome', i.produto_nome, 'sabor_nome', i.sabor_nome)), '[]')
                from public.producao_itens i where i.evento_id in (select id from ev)),
    'consumo', (select coalesce(jsonb_agg(jsonb_build_object('ingrediente', c.ingredient_id, 'nome', c.ingrediente_nome, 'unidade', c.unidade,
                       'receita', c.quantidade_receita, 'real', c.quantidade_real, 'custo', c.custo_unitario)), '[]')
                  from public.producao_consumos c where c.evento_id in (select id from ev)))
$$;

-- Net stock change from one state to another: + units produced, - ingredients consumed.
create or replace function public.producao_deltas(p_antes jsonb, p_depois jsonb) returns jsonb
language sql immutable set search_path = public as $$
  with m as (
    select 'produto' as alvo, (x->>'produto')::uuid as id, -(x->>'unidades')::numeric as d from jsonb_array_elements(coalesce(p_antes->'itens', '[]')) x
    union all select 'produto', (x->>'produto')::uuid, (x->>'unidades')::numeric from jsonb_array_elements(coalesce(p_depois->'itens', '[]')) x
    union all select 'sabor', (x->>'sabor')::uuid, -(x->>'unidades')::numeric from jsonb_array_elements(coalesce(p_antes->'itens', '[]')) x where nullif(x->>'sabor', '') is not null
    union all select 'sabor', (x->>'sabor')::uuid, (x->>'unidades')::numeric from jsonb_array_elements(coalesce(p_depois->'itens', '[]')) x where nullif(x->>'sabor', '') is not null
    union all select 'ingrediente', (x->>'ingrediente')::uuid, (x->>'real')::numeric from jsonb_array_elements(coalesce(p_antes->'consumo', '[]')) x
    union all select 'ingrediente', (x->>'ingrediente')::uuid, -(x->>'real')::numeric from jsonb_array_elements(coalesce(p_depois->'consumo', '[]')) x
  )
  select coalesce(jsonb_agg(jsonb_build_object('alvo', s.alvo, 'id', s.id, 'delta', s.d) order by s.alvo, s.id), '[]')
    from (select alvo, id, sum(d) as d from m group by 1, 2 having sum(d) <> 0) s
$$;

-- Locks, checks and applies the deltas, writing the ledger. Nothing moves if any check fails.
create or replace function public.producao_aplicar(p_user uuid, p_registro uuid, p_evento uuid, p_deltas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d record; v_antes numeric; v_nome text; v_un text;
  v_falta text[] := '{}'; v_vendido text[] := '{}'; v_detalhe jsonb := '[]';
begin
  -- fixed lock order: products, flavours, ingredients, each by id
  perform 1 from public.products where id in (select (x->>'id')::uuid from jsonb_array_elements(p_deltas) x where x->>'alvo' = 'produto') order by id for update;
  perform 1 from public.product_variants where id in (select (x->>'id')::uuid from jsonb_array_elements(p_deltas) x where x->>'alvo' = 'sabor') order by id for update;
  perform 1 from public.ingredients where id in (select (x->>'id')::uuid from jsonb_array_elements(p_deltas) x where x->>'alvo' = 'ingrediente') order by id for update;

  for d in select x->>'alvo' as alvo, (x->>'id')::uuid as id, (x->>'delta')::numeric as delta from jsonb_array_elements(p_deltas) x loop
    if d.alvo = 'produto' then
      select p.stock_quantity, p.name into v_antes, v_nome from public.products p where p.id = d.id and p.user_id = p_user;
    elsif d.alvo = 'sabor' then
      select v.stock_quantity, p.name || ' ' || v.name into v_antes, v_nome
        from public.product_variants v join public.products p on p.id = v.product_id where v.id = d.id and v.user_id = p_user;
    else
      select g.stock_quantity, g.name, g.unit into v_antes, v_nome, v_un from public.ingredients g where g.id = d.id and g.user_id = p_user;
    end if;
    if not found then
      raise exception 'Um item desta produção foi apagado do cadastro; não dá para alterar o estoque dele.' using hint = 'VANT_ITEM_APAGADO';
    end if;
    if d.delta < 0 and v_antes + d.delta < 0 then
      v_detalhe := v_detalhe || jsonb_build_object('alvo', d.alvo, 'id', d.id, 'nome', v_nome, 'precisa', -d.delta, 'tem', v_antes);
      if d.alvo = 'ingrediente' then
        v_falta := v_falta || format('%s (precisa %s %s, tem %s %s)', v_nome, public.producao_num(-d.delta), v_un, public.producao_num(greatest(v_antes, 0)), v_un);
      else
        v_vendido := v_vendido || format('%s (precisa tirar %s, só restam %s no estoque)', v_nome, public.producao_num(-d.delta), public.producao_num(greatest(v_antes, 0)));
      end if;
    end if;
  end loop;

  if array_length(v_falta, 1) > 0 then
    raise exception 'Falta ingrediente: %.', array_to_string(v_falta, '; ')
      using hint = 'VANT_FALTA_INGREDIENTE', detail = v_detalhe::text;
  end if;
  if array_length(v_vendido, 1) > 0 then
    raise exception 'Essas unidades já foram vendidas ou saíram do estoque: %.', array_to_string(v_vendido, '; ')
      using hint = 'VANT_UNIDADES_VENDIDAS', detail = v_detalhe::text;
  end if;

  for d in select x->>'alvo' as alvo, (x->>'id')::uuid as id, (x->>'delta')::numeric as delta from jsonb_array_elements(p_deltas) x loop
    if d.alvo = 'produto' then
      -- same as produto_produzir*: producing turns stock control on
      update public.products set stock_quantity = stock_quantity + d.delta::int,
             controla_estoque = case when d.delta > 0 then true else controla_estoque end, updated_at = now()
       where id = d.id returning stock_quantity - d.delta::int into v_antes;
    elsif d.alvo = 'sabor' then
      update public.product_variants set stock_quantity = stock_quantity + d.delta::int, updated_at = now()
       where id = d.id returning stock_quantity - d.delta::int into v_antes;
    else
      update public.ingredients set stock_quantity = stock_quantity + d.delta, updated_at = now()
       where id = d.id returning stock_quantity - d.delta into v_antes;
    end if;
    insert into public.producao_movimentos (evento_id, registro_id, user_id, alvo, alvo_id, delta, antes, depois)
    values (p_evento, p_registro, p_user, d.alvo, d.id, d.delta, v_antes, v_antes + d.delta);
  end loop;

  return (select coalesce(jsonb_agg(jsonb_build_object('alvo', m.alvo, 'id', m.alvo_id, 'antes', m.antes, 'depois', m.depois) order by m.id), '[]')
            from public.producao_movimentos m where m.evento_id = p_evento);
end $$;

-- Writes a version's items and consumption, then the event with its answer.
create or replace function public.producao_gravar(p_user uuid, p_registro uuid, p_evento uuid, p_tipo text, p_versao integer,
  p_chave text, p_hash text, p_estado jsonb, p_estoque jsonb, p_motivo text, p_notas text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_resp jsonb; v_status text;
begin
  insert into public.producao_itens (evento_id, registro_id, user_id, product_id, variant_id, produto_nome, sabor_nome, unidades)
  select p_evento, p_registro, p_user, (x->>'produto')::uuid, nullif(x->>'sabor', '')::uuid, x->>'produto_nome', x->>'sabor_nome', (x->>'unidades')::int
    from jsonb_array_elements(coalesce(p_estado->'itens', '[]')) x;
  insert into public.producao_consumos (evento_id, registro_id, user_id, ingredient_id, ingrediente_nome, unidade, quantidade_receita, quantidade_real, custo_unitario)
  select p_evento, p_registro, p_user, (x->>'ingrediente')::uuid, x->>'nome', x->>'unidade', (x->>'receita')::numeric, (x->>'real')::numeric, (x->>'custo')::numeric
    from jsonb_array_elements(coalesce(p_estado->'consumo', '[]')) x;
  select status into v_status from public.producao_registros where id = p_registro;
  v_resp := jsonb_build_object('registro_id', p_registro, 'evento_id', p_evento, 'tipo', p_tipo, 'versao', p_versao, 'status', v_status,
    'itens', coalesce(p_estado->'itens', '[]'), 'consumo', coalesce(p_estado->'consumo', '[]'),
    'avisos', coalesce(p_estado->'avisos', '[]'), 'estoque', p_estoque, 'repetido', false);
  insert into public.producao_eventos (id, registro_id, user_id, tipo, versao, chave, conteudo_hash, motivo, notas, resposta)
  values (p_evento, p_registro, p_user, p_tipo, p_versao, p_chave, p_hash, p_motivo, p_notas, v_resp);
  return v_resp;
end $$;

-- ------------------------------------------------------------------ entry points
create or replace function public.producao_registrar(p_chave text, p_itens jsonb, p_consumo jsonb default null, p_notas text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); v_hash text; v_resp jsonb; v_estado jsonb; v_reg uuid; v_ev uuid := gen_random_uuid(); v_estoque jsonb;
begin
  if u is null then raise exception 'Faça login para registrar a produção.' using hint = 'VANT_LOGIN'; end if;
  perform public.producao_validar_chave(p_chave);
  if p_notas is not null and char_length(p_notas) > 300 then raise exception 'Observação muito longa (máx. 300).' using hint = 'VANT_TEXTO_LONGO'; end if;
  v_hash := md5(jsonb_build_object('tipo', 'registro', 'itens', p_itens, 'consumo', p_consumo, 'notas', p_notas)::text);
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || p_chave, 0));
  v_resp := public.producao_repetido(u, p_chave, v_hash);
  if v_resp is not null then return v_resp; end if;

  v_estado := public.producao_estado_alvo(u, p_itens, p_consumo);
  insert into public.producao_registros (user_id) values (u) returning id into v_reg;
  v_estoque := public.producao_aplicar(u, v_reg, v_ev, public.producao_deltas('{}', v_estado));
  return public.producao_gravar(u, v_reg, v_ev, 'registro', 1, p_chave, v_hash, v_estado, v_estoque, null, p_notas);
end $$;

create or replace function public.producao_corrigir(p_registro uuid, p_chave text, p_itens jsonb, p_consumo jsonb default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); v_hash text; v_resp jsonb; r record; v_antes jsonb; v_depois jsonb; v_deltas jsonb;
  v_ev uuid := gen_random_uuid(); v_estoque jsonb;
begin
  if u is null then raise exception 'Faça login para corrigir a produção.' using hint = 'VANT_LOGIN'; end if;
  perform public.producao_validar_chave(p_chave);
  if p_motivo is null or char_length(trim(p_motivo)) < 3 or char_length(p_motivo) > 300 then
    raise exception 'Diga o motivo da correção (3 a 300 letras).' using hint = 'VANT_MOTIVO_OBRIGATORIO';
  end if;
  v_hash := md5(jsonb_build_object('tipo', 'correcao', 'registro', p_registro, 'itens', p_itens, 'consumo', p_consumo, 'motivo', p_motivo)::text);
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || p_chave, 0));
  v_resp := public.producao_repetido(u, p_chave, v_hash);
  if v_resp is not null then return v_resp; end if;

  select * into r from public.producao_registros where id = p_registro and user_id = u for update;
  if not found then raise exception 'Produção não encontrada.' using hint = 'VANT_REGISTRO_INVALIDO'; end if;
  if r.status = 'desfeita' then
    raise exception 'Essa produção foi desfeita. Registre uma nova.' using hint = 'VANT_REGISTRO_DESFEITO';
  end if;
  v_antes := public.producao_estado_atual(p_registro);
  v_depois := public.producao_estado_alvo(u, p_itens, p_consumo);
  v_deltas := public.producao_deltas(v_antes, v_depois);
  if jsonb_array_length(v_deltas) = 0 then
    raise exception 'A correção é igual à produção atual.' using hint = 'VANT_SEM_MUDANCA';
  end if;
  update public.producao_registros set status = 'corrigida', versao = r.versao + 1, atualizado_em = now() where id = p_registro;
  v_estoque := public.producao_aplicar(u, p_registro, v_ev, v_deltas);
  return public.producao_gravar(u, p_registro, v_ev, 'correcao', r.versao + 1, p_chave, v_hash, v_depois, v_estoque, p_motivo, null);
end $$;

create or replace function public.producao_desfazer(p_registro uuid, p_chave text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); v_hash text; v_resp jsonb; r record; v_antes jsonb; v_ev uuid := gen_random_uuid(); v_estoque jsonb;
begin
  if u is null then raise exception 'Faça login para desfazer a produção.' using hint = 'VANT_LOGIN'; end if;
  perform public.producao_validar_chave(p_chave);
  if p_motivo is null or char_length(trim(p_motivo)) < 3 or char_length(p_motivo) > 300 then
    raise exception 'Diga o motivo para desfazer (3 a 300 letras).' using hint = 'VANT_MOTIVO_OBRIGATORIO';
  end if;
  v_hash := md5(jsonb_build_object('tipo', 'desfazer', 'registro', p_registro, 'motivo', p_motivo)::text);
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || p_chave, 0));
  v_resp := public.producao_repetido(u, p_chave, v_hash);
  if v_resp is not null then return v_resp; end if;

  select * into r from public.producao_registros where id = p_registro and user_id = u for update;
  if not found then raise exception 'Produção não encontrada.' using hint = 'VANT_REGISTRO_INVALIDO'; end if;
  if r.status = 'desfeita' then
    raise exception 'Essa produção já foi desfeita.' using hint = 'VANT_REGISTRO_DESFEITO';
  end if;
  -- returns exactly what this registro moved (stored real consumption), never today's recipe
  v_antes := public.producao_estado_atual(p_registro);
  update public.producao_registros set status = 'desfeita', versao = r.versao + 1, atualizado_em = now() where id = p_registro;
  v_estoque := public.producao_aplicar(u, p_registro, v_ev, public.producao_deltas(v_antes, '{}'));
  return public.producao_gravar(u, p_registro, v_ev, 'desfazer', r.versao + 1, p_chave, v_hash, '{}', v_estoque, p_motivo, null);
end $$;

-- ------------------------------------------------------------------ grants
-- Only the three entry points are callable, and only by a logged user (auth.uid() inside).
revoke all on function public.producao_imutavel() from public, anon, authenticated;
revoke all on function public.producao_sem_truncate() from public, anon, authenticated;
revoke all on function public.producao_num(numeric) from public, anon, authenticated;
revoke all on function public.producao_validar_chave(text) from public, anon, authenticated;
revoke all on function public.producao_repetido(uuid, text, text) from public, anon, authenticated;
revoke all on function public.producao_estado_alvo(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.producao_estado_atual(uuid) from public, anon, authenticated;
revoke all on function public.producao_deltas(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.producao_aplicar(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.producao_gravar(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.producao_registrar(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.producao_corrigir(uuid, text, jsonb, jsonb, text) from public, anon;
revoke all on function public.producao_desfazer(uuid, text, text) from public, anon;
grant execute on function public.producao_registrar(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.producao_corrigir(uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.producao_desfazer(uuid, text, text) to authenticated;
