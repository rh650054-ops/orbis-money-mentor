-- Raio-X do extrato: devolver a cota diaria quando a IA falha (erro nosso, nao do vendedor).
-- Nunca deixa o contador negativo. Admins nunca consomem cota, entao nao tem o que devolver.
create or replace function public.refund_ai_usage(p_feature text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  c int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.ai_usage
     set count = greatest(count - 1, 0), updated_at = now()
   where user_id = auth.uid() and dia = d and feature = p_feature
  returning count into c;
  return jsonb_build_object('ok', true, 'count', coalesce(c, 0));
end;
$function$;

revoke all on function public.refund_ai_usage(text) from public;
grant execute on function public.refund_ai_usage(text) to authenticated;

-- anon (sem login) nao pode chamar: so quem esta logado tem cota pra devolver.
revoke execute on function public.refund_ai_usage(text) from anon;
