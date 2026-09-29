-- Raio-X do extrato (Rick, 29/09/2026): o vendedor manda o extrato dos bancos, a IA le
-- TODOS os lancamentos, categoriza (iFood, Uber, mercado, Pix pra pessoas...) e a tela
-- mostra pra onde o dinheiro foi e o que esta pesando. So guardamos descricao, valor,
-- data e categoria — nunca agencia, conta, saldo ou CPF. O arquivo e descartado.

-- ---------- arquivos lidos (hash evita ler o mesmo extrato duas vezes) ----------
create table if not exists public.extrato_arquivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  banco text,
  mes date not null,                    -- primeiro dia do mes coberto
  hash text not null,                   -- sha256 do arquivo
  lancamentos int not null default 0,
  periodo_inicio date,
  periodo_fim date,
  origem text not null default 'arquivo', -- arquivo | pluggy
  criado_em timestamptz not null default now(),
  unique (user_id, hash)
);

-- ---------- lancamentos ----------
create table if not exists public.extrato_lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  arquivo_id uuid references public.extrato_arquivos(id) on delete cascade,
  data date not null,
  hora time,
  descricao text not null,
  descricao_norm text not null,         -- descricao limpa (maiusculas, sem numero/pontuacao) pra dedupe e regra
  comerciante text,                     -- chave curta do comerciante ("IFOOD", "UBER", "PIX JOAO S")
  valor numeric(12,2) not null check (valor >= 0),
  tipo text not null check (tipo in ('saida','entrada')),
  categoria text not null default 'nao_identificado',
  esfera text not null default 'pessoal' check (esfera in ('corre','pessoal')),
  confianca text not null default 'ia' check (confianca in ('regra','ia','usuario','baixa')),
  banco text,
  criado_em timestamptz not null default now(),
  unique (user_id, data, valor, tipo, descricao_norm)
);
create index if not exists extrato_lanc_user_mes on public.extrato_lancamentos (user_id, data);
create index if not exists extrato_lanc_user_com on public.extrato_lancamentos (user_id, comerciante);

-- ---------- regras que o usuario ensinou ("mover") ----------
create table if not exists public.extrato_regras_usuario (
  user_id uuid not null,
  comerciante text not null,
  categoria text not null,
  esfera text not null check (esfera in ('corre','pessoal')),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, comerciante)
);

-- ---------- RLS: cada um ve so o seu; escrita so pelo backend (service role) e pelos RPCs ----------
alter table public.extrato_arquivos enable row level security;
alter table public.extrato_lancamentos enable row level security;
alter table public.extrato_regras_usuario enable row level security;
drop policy if exists extrato_arquivos_sel on public.extrato_arquivos;
create policy extrato_arquivos_sel on public.extrato_arquivos for select using (user_id = auth.uid());
drop policy if exists extrato_lanc_sel on public.extrato_lancamentos;
create policy extrato_lanc_sel on public.extrato_lancamentos for select using (user_id = auth.uid());
drop policy if exists extrato_regras_sel on public.extrato_regras_usuario;
create policy extrato_regras_sel on public.extrato_regras_usuario for select using (user_id = auth.uid());

-- ---------- catalogo de categorias (rotulo, icone, esfera padrao) ----------
create table if not exists public.extrato_categorias (
  slug text primary key,
  rotulo text not null,
  icone text not null,
  esfera_padrao text not null check (esfera_padrao in ('corre','pessoal')),
  tipo text not null check (tipo in ('saida','entrada')),
  ordem int not null default 100
);
insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem) values
  ('mercadoria',        'Mercadoria',           '📦', 'corre',   'saida', 1),
  ('insumos',           'Gelo, embalagem, gás', '🧊', 'corre',   'saida', 2),
  ('onibus',            'Ônibus / passagem',    '🚌', 'corre',   'saida', 3),
  ('combustivel',       'Combustível',          '⛽', 'corre',   'saida', 4),
  ('transporte_app',    'Transporte por app',   '🚗', 'pessoal', 'saida', 10),
  ('delivery',          'Delivery',             '🍔', 'pessoal', 'saida', 11),
  ('restaurante',       'Bares e lanches',      '🍽️', 'pessoal', 'saida', 12),
  ('mercado',           'Mercado',              '🛒', 'pessoal', 'saida', 13),
  ('pix_pessoas',       'Pix pra pessoas',      '👤', 'pessoal', 'saida', 14),
  ('assinaturas',       'Assinaturas',          '📱', 'pessoal', 'saida', 15),
  ('contas_casa',       'Contas da casa',       '🏠', 'pessoal', 'saida', 16),
  ('celular_internet',  'Celular / internet',   '📶', 'pessoal', 'saida', 17),
  ('farmacia',          'Farmácia',             '💊', 'pessoal', 'saida', 18),
  ('roupas',            'Roupas e calçados',    '👟', 'pessoal', 'saida', 19),
  ('lazer',             'Lazer',                '🎮', 'pessoal', 'saida', 20),
  ('parcelas',          'Parcelas e empréstimo','💳', 'pessoal', 'saida', 21),
  ('saque',             'Saque em dinheiro',    '🏧', 'pessoal', 'saida', 22),
  ('taxas',             'Tarifas do banco',     '🏦', 'pessoal', 'saida', 23),
  ('apostas',           'Apostas',              '🎰', 'pessoal', 'saida', 24),
  ('transferencia_propria','Entre minhas contas','🔁','pessoal','saida', 90),
  ('outros',            'Outros',               '📎', 'pessoal', 'saida', 95),
  ('nao_identificado',  'Não identificados',    '❓', 'pessoal', 'saida', 99),
  ('pix_recebido',      'Pix recebido',         '💚', 'corre',   'entrada', 1),
  ('cartao_recebido',   'Cartão recebido',      '💳', 'corre',   'entrada', 2),
  ('transferencia_recebida','Transferência recebida','⬇️','pessoal','entrada', 3),
  ('estorno',           'Estorno',              '↩️', 'pessoal', 'entrada', 4),
  ('outros_entrada',    'Outras entradas',      '➕', 'pessoal', 'entrada', 9)
on conflict (slug) do update set rotulo = excluded.rotulo, icone = excluded.icone, esfera_padrao = excluded.esfera_padrao, tipo = excluded.tipo, ordem = excluded.ordem;
alter table public.extrato_categorias enable row level security;
drop policy if exists extrato_cat_sel on public.extrato_categorias;
create policy extrato_cat_sel on public.extrato_categorias for select using (true);

-- ---------- normalizacao (mesma regra no backend e no banco) ----------
create or replace function public.extrato_norm(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(regexp_replace(upper(coalesce(p,'')), '[0-9]+', ' ', 'g'), '[^A-Z ]+', ' ', 'g'))
$$;

-- ---------- meses disponiveis ----------
create or replace function public.extrato_meses()
returns table (mes date, lancamentos bigint, bancos text[])
language sql security invoker stable as $$
  select date_trunc('month', data)::date as mes, count(*), array_agg(distinct coalesce(banco,'?'))
  from public.extrato_lancamentos where user_id = auth.uid()
  group by 1 order by 1 desc
$$;

-- ---------- resumo do mes: a tela inteira numa chamada ----------
create or replace function public.extrato_resumo(p_mes date)
returns jsonb
language plpgsql security invoker stable as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_ant date := (date_trunc('month', p_mes) - interval '1 month')::date;
  v_saiu numeric; v_entrou numeric; v_qtd int; v_bancos text[]; v_corre numeric; v_pessoal numeric;
  v_cats jsonb; v_viloes jsonb; v_arquivos jsonb; v_nid int;
begin
  select coalesce(sum(valor) filter (where tipo='saida' and categoria <> 'transferencia_propria'),0),
         coalesce(sum(valor) filter (where tipo='entrada'),0),
         count(*), array_agg(distinct banco) filter (where banco is not null),
         coalesce(sum(valor) filter (where tipo='saida' and esfera='corre' and categoria <> 'transferencia_propria'),0),
         coalesce(sum(valor) filter (where tipo='saida' and esfera='pessoal' and categoria <> 'transferencia_propria'),0),
         count(*) filter (where categoria='nao_identificado')
    into v_saiu, v_entrou, v_qtd, v_bancos, v_corre, v_pessoal, v_nid
  from public.extrato_lancamentos where user_id = auth.uid() and data >= v_ini and data < v_fim;

  -- categorias de saida, com o mes anterior pra comparar
  with atual as (
    select categoria, esfera, sum(valor) total, count(*) qtd
    from public.extrato_lancamentos where user_id = auth.uid() and data >= v_ini and data < v_fim and tipo='saida'
    group by 1,2),
  anterior as (
    select categoria, sum(valor) total from public.extrato_lancamentos
    where user_id = auth.uid() and data >= v_ant and data < v_ini and tipo='saida' group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'categoria', a.categoria, 'rotulo', c.rotulo, 'icone', c.icone, 'esfera', a.esfera,
      'total', a.total, 'qtd', a.qtd,
      'pct', case when v_saiu > 0 then round(a.total / v_saiu * 100) else 0 end,
      'anterior', coalesce(n.total, 0)) order by a.total desc), '[]'::jsonb)
    into v_cats
  from atual a left join public.extrato_categorias c on c.slug = a.categoria left join anterior n on n.categoria = a.categoria;

  -- viloes: top 3 categorias pessoais de saida, com o comerciante que mais pesou
  with atual as (
    select categoria, sum(valor) total, count(*) qtd, round(avg(valor),2) media
    from public.extrato_lancamentos where user_id = auth.uid() and data >= v_ini and data < v_fim and tipo='saida' and esfera='pessoal' and categoria not in ('transferencia_propria','nao_identificado')
    group by 1 order by 2 desc limit 3),
  anterior as (
    select categoria, sum(valor) total from public.extrato_lancamentos
    where user_id = auth.uid() and data >= v_ant and data < v_ini and tipo='saida' group by 1),
  top_com as (
    select distinct on (l.categoria) l.categoria, l.comerciante, sum(l.valor) total, count(*) qtd
    from public.extrato_lancamentos l join atual a on a.categoria = l.categoria
    where l.user_id = auth.uid() and l.data >= v_ini and l.data < v_fim and l.tipo='saida'
    group by l.categoria, l.comerciante order by l.categoria, sum(l.valor) desc),
  madrugada as (
    select categoria, count(*) qtd from public.extrato_lancamentos
    where user_id = auth.uid() and data >= v_ini and data < v_fim and tipo='saida' and hora is not null and (hora >= '23:00' or hora < '05:00')
    group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'categoria', a.categoria, 'rotulo', c.rotulo, 'icone', c.icone, 'total', a.total, 'qtd', a.qtd, 'media', a.media,
      'anterior', coalesce(n.total,0), 'top_comerciante', t.comerciante, 'top_total', t.total, 'top_qtd', t.qtd,
      'madrugada', coalesce(m.qtd,0)) order by a.total desc), '[]'::jsonb)
    into v_viloes
  from atual a left join public.extrato_categorias c on c.slug=a.categoria left join anterior n on n.categoria=a.categoria
  left join top_com t on t.categoria=a.categoria left join madrugada m on m.categoria=a.categoria;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'banco', banco, 'lancamentos', lancamentos, 'inicio', periodo_inicio, 'fim', periodo_fim, 'origem', origem, 'quando', criado_em) order by criado_em desc), '[]'::jsonb)
    into v_arquivos from public.extrato_arquivos where user_id = auth.uid() and mes = v_ini;

  return jsonb_build_object('mes', v_ini, 'saiu', v_saiu, 'entrou', v_entrou, 'lancamentos', v_qtd, 'bancos', coalesce(v_bancos, '{}'),
    'corre', v_corre, 'pessoal', v_pessoal, 'nao_identificados', v_nid, 'categorias', v_cats, 'viloes', v_viloes, 'arquivos', v_arquivos);
end $$;

-- ---------- lancamentos de uma categoria (ou todos os nao identificados) ----------
create or replace function public.extrato_lista(p_mes date, p_categoria text default null, p_tipo text default 'saida')
returns table (id uuid, data date, hora time, descricao text, comerciante text, valor numeric, categoria text, esfera text, confianca text, banco text)
language sql security invoker stable as $$
  select id, data, hora, descricao, comerciante, valor, categoria, esfera, confianca, banco
  from public.extrato_lancamentos
  where user_id = auth.uid() and data >= date_trunc('month', p_mes)::date and data < (date_trunc('month', p_mes) + interval '1 month')::date
    and (p_tipo is null or tipo = p_tipo) and (p_categoria is null or categoria = p_categoria)
  order by data desc, hora desc nulls last, valor desc
$$;

-- ---------- "mover": corrige um lancamento, ensina a regra e aplica no mesmo comerciante ----------
create or replace function public.extrato_mover(p_id uuid, p_categoria text, p_esfera text default null)
returns int
language plpgsql security invoker as $$
declare v_com text; v_esf text; v_n int;
begin
  if not exists (select 1 from public.extrato_categorias where slug = p_categoria) then raise exception 'categoria invalida'; end if;
  select comerciante into v_com from public.extrato_lancamentos where id = p_id and user_id = auth.uid();
  if v_com is null then
    update public.extrato_lancamentos set categoria = p_categoria, esfera = coalesce(p_esfera, esfera), confianca = 'usuario' where id = p_id and user_id = auth.uid();
    return 1;
  end if;
  select coalesce(p_esfera, esfera_padrao) into v_esf from public.extrato_categorias where slug = p_categoria;
  insert into public.extrato_regras_usuario (user_id, comerciante, categoria, esfera) values (auth.uid(), v_com, p_categoria, v_esf)
    on conflict (user_id, comerciante) do update set categoria = excluded.categoria, esfera = excluded.esfera, atualizado_em = now();
  update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario'
    where user_id = auth.uid() and comerciante = v_com and confianca <> 'usuario';
  get diagnostics v_n = row_count;
  update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario' where id = p_id and user_id = auth.uid();
  return greatest(v_n, 1);
end $$;

-- ---------- apagar um arquivo (e seus lancamentos) ----------
create or replace function public.extrato_apagar_arquivo(p_id uuid)
returns void language sql security invoker as $$
  delete from public.extrato_arquivos where id = p_id and user_id = auth.uid();
$$;

-- update/delete pelos RPCs precisam de policy (security invoker respeita RLS)
drop policy if exists extrato_lanc_upd on public.extrato_lancamentos;
create policy extrato_lanc_upd on public.extrato_lancamentos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists extrato_arquivos_del on public.extrato_arquivos;
create policy extrato_arquivos_del on public.extrato_arquivos for delete using (user_id = auth.uid());
drop policy if exists extrato_lanc_del on public.extrato_lancamentos;
create policy extrato_lanc_del on public.extrato_lancamentos for delete using (user_id = auth.uid());
drop policy if exists extrato_regras_ins on public.extrato_regras_usuario;
create policy extrato_regras_ins on public.extrato_regras_usuario for insert with check (user_id = auth.uid());
drop policy if exists extrato_regras_upd on public.extrato_regras_usuario;
create policy extrato_regras_upd on public.extrato_regras_usuario for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant execute on function public.extrato_meses() to authenticated;
grant execute on function public.extrato_resumo(date) to authenticated;
grant execute on function public.extrato_lista(date, text, text) to authenticated;
grant execute on function public.extrato_mover(uuid, text, text) to authenticated;
grant execute on function public.extrato_apagar_arquivo(uuid) to authenticated;
grant execute on function public.extrato_norm(text) to authenticated, service_role;
