-- ============================================================
-- FINANÇAS · ANÁLISE: TETO POR CATEGORIA + MOVER SÓ ESTE PIX — 05/10/2026
-- Pedido do Rick:
--  1) "uma opção definindo o teto de gastos: fast food, esse é o teto; mercado, esse é o teto".
--     Tabela financas_tetos (1 linha por categoria). No rastreador o teto substitui o
--     "seu normal" (média dos 3 meses) — barra, ritmo e alerta passam a usar o teto.
--  2) "mover os Pix pra outra funcionalidade dos gastos": o Raio-X já movia, mas movia
--     TODOS do mesmo nome (regra do comerciante). Pix pra pessoa varia — o amigo que
--     recebeu pelo transporte hoje recebe por outra coisa amanhã. extrato_mover_um move
--     só aquele lançamento e trava ele (categoria_fixa): nem regra nem reanálise mexem.
-- ============================================================

create table if not exists public.financas_tetos (
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null references public.extrato_categorias(slug) on update cascade,
  valor numeric(12,2) not null check (valor > 0 and valor <= 1000000),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, categoria)
);
alter table public.financas_tetos enable row level security;
drop policy if exists financas_tetos_dono on public.financas_tetos;
create policy financas_tetos_dono on public.financas_tetos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- define (valor > 0) ou tira (null/0) o teto de uma categoria de SAÍDA
create or replace function public.financas_teto_definir(p_categoria text, p_valor numeric)
returns void language plpgsql security invoker set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'login necessario'; end if;
  if not exists (select 1 from public.extrato_categorias where slug = p_categoria and tipo = 'saida'
                   and slug not in ('transferencia_propria', 'fatura_cartao', 'nao_identificado')) then
    raise exception 'categoria invalida';
  end if;
  if p_valor is null or p_valor <= 0 then
    delete from public.financas_tetos where user_id = auth.uid() and categoria = p_categoria;
  else
    insert into public.financas_tetos (user_id, categoria, valor)
    values (auth.uid(), p_categoria, round(p_valor, 2))
    on conflict (user_id, categoria) do update set valor = excluded.valor, atualizado_em = now();
  end if;
end $$;

-- lista pro editor de tetos: toda categoria de saída, com o teto dele (se tiver)
create or replace function public.financas_tetos_lista()
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('categoria', c.slug, 'rotulo', c.rotulo, 'icone', c.icone,
           'teto', t.valor) order by c.ordem, c.rotulo), '[]'::jsonb)
    from public.extrato_categorias c
    left join public.financas_tetos t on t.categoria = c.slug and t.user_id = auth.uid()
   where auth.uid() is not null and c.tipo = 'saida'
     and c.slug not in ('transferencia_propria', 'fatura_cartao', 'nao_identificado', 'estorno');
$$;

grant select, insert, update, delete on public.financas_tetos to authenticated;
grant execute on function public.financas_teto_definir(text, numeric) to authenticated;
grant execute on function public.financas_tetos_lista() to authenticated;

-- ---------- 2) mover SÓ ESTE lançamento ----------
alter table public.extrato_lancamentos add column if not exists categoria_fixa boolean not null default false;

-- Lançamento travado pelo vendedor não muda mais de categoria sozinho (regra do comerciante,
-- consolidação, reanálise). Só as funções de mover (que ligam vant.mover) podem mexer.
create or replace function public.extrato_lancamento_trava()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if old.categoria_fixa and coalesce(current_setting('vant.mover', true), '') <> '1' then
    new.categoria := old.categoria;
    new.esfera := old.esfera;
    new.confianca := 'usuario';
    new.categoria_fixa := true;
  end if;
  return new;
end $$;
drop trigger if exists extrato_lancamento_trava on public.extrato_lancamentos;
create trigger extrato_lancamento_trava before update on public.extrato_lancamentos
  for each row execute function public.extrato_lancamento_trava();

create or replace function public.extrato_mover_um(p_id uuid, p_categoria text)
returns integer language plpgsql security invoker set search_path to 'public' as $$
declare v_tipo text; v_ctipo text; v_esf text;
begin
  select tipo into v_tipo from public.extrato_lancamentos where id = p_id and user_id = auth.uid();
  if v_tipo is null then raise exception 'lancamento nao encontrado'; end if;
  select tipo, esfera_padrao into v_ctipo, v_esf from public.extrato_categorias where slug = p_categoria;
  if v_ctipo is distinct from v_tipo then raise exception 'categoria invalida pra esse lancamento'; end if;
  perform set_config('vant.mover', '1', true);
  update public.extrato_lancamentos
     set categoria = p_categoria, esfera = v_esf, confianca = 'usuario', categoria_fixa = true
   where id = p_id and user_id = auth.uid();
  perform set_config('vant.mover', '0', true);
  perform public.extrato_reanalisar();
  return 1;
end $$;
grant execute on function public.extrato_mover_um(uuid, text) to authenticated;

-- O "mover todos" de sempre continua igual, só que agora também pode mexer num
-- lançamento travado quando é ESSE o escolhido (destrava ele e segue a regra).
create or replace function public.extrato_mover(p_id uuid, p_categoria text, p_esfera text DEFAULT NULL::text)
 returns integer language plpgsql set search_path to 'public' as $function$
declare v_chave text; v_tipo text; v_ctipo text; v_esf text; v_n int := 0;
begin
  select chave, tipo into v_chave, v_tipo from public.extrato_lancamentos where id = p_id and user_id = auth.uid();
  if v_tipo is null then raise exception 'lancamento nao encontrado'; end if;
  select tipo, coalesce(p_esfera, esfera_padrao) into v_ctipo, v_esf from public.extrato_categorias where slug = p_categoria;
  if v_ctipo is distinct from v_tipo then raise exception 'categoria invalida pra esse lancamento'; end if;
  if v_esf not in ('corre', 'pessoal') then raise exception 'esfera invalida'; end if;

  perform set_config('vant.mover', '1', true);
  update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario', categoria_fixa = false
   where id = p_id and user_id = auth.uid();
  perform set_config('vant.mover', '0', true);
  if v_chave is not null then
    insert into public.extrato_regras_usuario (user_id, comerciante, tipo, categoria, esfera, valor_min)
    values (auth.uid(), v_chave, v_tipo, p_categoria, v_esf, null)
    on conflict (user_id, comerciante, tipo) do update
      set categoria = excluded.categoria, esfera = excluded.esfera, valor_min = null, atualizado_em = now();
    -- os travados (movidos "só este") ficam onde ele pôs
    update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario'
     where user_id = auth.uid() and chave = v_chave and tipo = v_tipo and id <> p_id
       and movimento <> 'entre_contas' and not categoria_fixa;
    get diagnostics v_n = row_count;
  end if;
  perform public.extrato_reanalisar();
  return v_n + 1;
end $function$;

-- ---------- rastreador com teto ----------
create or replace function public.financas_rastreador()
returns jsonb language sql stable security invoker set search_path to 'public' as $$
  with p as (
    select (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  q as (
    select hoje, date_trunc('month', hoje)::date as ini,
           extract(day from hoje)::int as dia,
           extract(day from (date_trunc('month', hoje) + interval '1 month - 1 day'))::int as dias
      from p
  ),
  rg as (
    select m.mes, x.*
      from q, generate_series(0, 3) g
      cross join lateral (select (q.ini - make_interval(months => g))::date as mes) m
      cross join lateral public.rastreador_gastos_mes(m.mes) x
  ),
  atual as (select * from rg where mes = (select ini from q)),
  meses_fechados as (select count(distinct mes) n from rg where mes < (select ini from q)),
  normal as (
    select categoria, sum(valor) / greatest((select n from meses_fechados), 1) as normal
      from rg where mes < (select ini from q) group by 1
  ),
  cat_atual as (select categoria, sum(valor) total, count(*) qtd from atual group by 1),
  tetos as (select categoria, valor from public.financas_tetos where user_id = auth.uid() and valor > 0),
  base_cat as (
    select coalesce(a.categoria, n.categoria) categoria, coalesce(a.total, 0) total, coalesce(a.qtd, 0) qtd,
           coalesce(n.normal, 0) historico
      from cat_atual a full outer join normal n on n.categoria = a.categoria
  ),
  -- o TETO que ele definiu manda; sem teto, vale o "seu normal" (média dos 3 meses)
  junto as (
    select coalesce(b.categoria, t.categoria) categoria, coalesce(b.total, 0) total, coalesce(b.qtd, 0) qtd,
           round(coalesce(t.valor, b.historico, 0), 2) normal,
           round(coalesce(t.valor, b.historico, 0) * (select dia from q) / (select dias from q), 2) esperado,
           t.valor is not null as tem_teto,
           round(coalesce(b.historico, 0), 2) historico
      from base_cat b full outer join tetos t on t.categoria = b.categoria
  ),
  cats as (
    select j.*, coalesce(c.rotulo, initcap(replace(j.categoria, '_', ' '))) rotulo, coalesce(c.icone, '📎') icone
      from junto j left join public.extrato_categorias c on c.slug = j.categoria
     where j.total > 0 or j.normal > 0
  ),
  -- conta fixa (assinatura, aluguel, parcela) cai de uma vez: só alerta se passou do MÊS inteiro.
  -- o resto (delivery, uber, lanche) alerta pelo ritmo: 30% e R$ 30 acima do normal pra essa altura.
  alerta as (
    select *, case when categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
                   then normal else esperado end as limite
      from cats
     where (categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
            and normal > 0 and total - normal >= 30 and total >= normal * 1.1)
        or (categoria not in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
            and esperado > 0 and not tem_teto and total - esperado >= 30 and total >= esperado * 1.3)
        or (tem_teto and categoria not in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
            and (total > normal or (total - esperado >= 10 and total >= esperado * 1.15)))
     order by total - (case when categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')
                            then normal else esperado end) desc limit 1
  ),
  ultimos as (
    select u.data, u.valor, u.descricao, coalesce(c.icone, '📎') icone
      from atual u left join public.extrato_categorias c on c.slug = u.categoria
     order by u.data desc, u.valor desc limit 4
  )
  select case
    when auth.uid() is null then null
    when not exists (select 1 from rg) then
      jsonb_build_object('tem_dados', false, 'mes', (select ini from q), 'dia', (select dia from q), 'dias_mes', (select dias from q))
    else jsonb_build_object(
      'tem_dados', true,
      'fonte', case when exists (select 1 from rg where fonte = 'banco') and exists (select 1 from rg where fonte = 'lancado') then 'misto'
                    when exists (select 1 from rg where fonte = 'banco') then 'banco' else 'lancado' end,
      'mes', (select ini from q), 'dia', (select dia from q), 'dias_mes', (select dias from q),
      'gasto', coalesce((select sum(valor) from atual), 0),
      'mes_passado_mesmo_dia', coalesce((select sum(valor) from rg
          where mes = ((select ini from q) - interval '1 month')::date and extract(day from data) <= (select dia from q)), 0),
      'normal_mes', round(coalesce((select sum(normal) from cats), 0), 2),
      'normal_ate_hoje', round(coalesce((select sum(normal) from cats), 0) * (select dia from q) / (select dias from q), 2),
      'projecao', case when (select dia from q) >= 5
                       then round(coalesce((select sum(valor) from atual), 0) / (select dia from q) * (select dias from q), 2) end,
      'semana', jsonb_build_object(
          'atual', coalesce((select sum(valor) from rg where data > (select hoje from q) - 7), 0),
          'anterior', coalesce((select sum(valor) from rg where data <= (select hoje from q) - 7 and data > (select hoje from q) - 14), 0)),
      'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'rotulo', rotulo, 'icone', icone,
                        'total', total, 'qtd', qtd, 'normal', normal, 'esperado', esperado,
                        'tem_teto', tem_teto, 'historico', historico) order by total desc, normal desc) from cats), '[]'::jsonb),
      'tem_tetos', exists (select 1 from tetos),
      'alerta', (select jsonb_build_object('categoria', categoria, 'rotulo', rotulo, 'icone', icone,
                        'total', total, 'esperado', limite, 'acima', total - limite, 'tem_teto', tem_teto,
                        'fixa', categoria in ('assinaturas', 'contas_casa', 'parcelas', 'celular_internet', 'impostos')) from alerta),
      'ultimos', coalesce((select jsonb_agg(jsonb_build_object('data', data, 'valor', valor, 'descricao', descricao, 'icone', icone)
                        order by data desc, valor desc) from ultimos), '[]'::jsonb))
  end;
$$;

grant execute on function public.financas_rastreador() to authenticated;
