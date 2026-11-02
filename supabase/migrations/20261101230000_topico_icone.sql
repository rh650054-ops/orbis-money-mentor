-- 01/11/2026 (Rick: "Não consegui criar. Tenta de novo." ao criar o tópico "Mercado").
-- extrato_categoria_criar inseria icone = null, mas extrato_categorias.icone é NOT NULL
-- desde 29/09 → todo "Criar tópico" falhava desde 19/10 (nenhum tópico personalizado existe).
-- Tópico do vendedor ganha o ícone 🏷️; a coluna também ganha esse default.
alter table public.extrato_categorias alter column icone set default '🏷️';

create or replace function public.extrato_categoria_criar(p_nome text, p_teto numeric default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_norm text;
  v_slug text;
  v_rotulo text;
begin
  if u is null then raise exception 'login necessario'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 30 then raise exception 'nome invalido'; end if;
  v_norm := public.extrato_norm(v_nome);
  if v_norm = '' then raise exception 'nome invalido'; end if;

  -- já existe (global ou dele) com esse nome? usa a mesma
  select c.slug, c.rotulo into v_slug, v_rotulo from public.extrato_categorias c
   where c.tipo = 'saida' and (c.user_id is null or c.user_id = u)
     and public.extrato_norm(c.rotulo) = v_norm
   order by c.user_id nulls first limit 1;

  if v_slug is null then
    if (select count(*) from public.extrato_categorias where user_id = u) >= 30 then
      raise exception 'limite de categorias';
    end if;
    v_slug := 'u_' || left(md5(u::text || v_norm), 12);
    v_rotulo := upper(left(v_nome, 1)) || substr(v_nome, 2);
    insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem, user_id)
    values (v_slug, v_rotulo, '🏷️', 'pessoal', 'saida', 900, u)
    on conflict (slug) do nothing;
  end if;

  if coalesce(p_teto, 0) > 0 and v_slug not in ('transferencia_propria', 'fatura_cartao', 'nao_identificado') then
    insert into public.financas_tetos (user_id, categoria, valor)
    values (u, v_slug, round(p_teto, 2))
    on conflict (user_id, categoria) do update set valor = excluded.valor, atualizado_em = now();
  end if;
  return jsonb_build_object('slug', v_slug, 'rotulo', v_rotulo);
end $function$;
revoke all on function public.extrato_categoria_criar(text, numeric) from public, anon;
grant execute on function public.extrato_categoria_criar(text, numeric) to authenticated;
