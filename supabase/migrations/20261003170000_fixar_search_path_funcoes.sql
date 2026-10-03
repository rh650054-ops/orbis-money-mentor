-- Security advisor (function_search_path_mutable): pin search_path on the
-- 5 helper functions that still had it mutable. Behavior unchanged.
alter function public.extrato_meses() set search_path = public;
alter function public.extrato_norm(text) set search_path = public;
alter function public.parc_nome_curto(text) set search_path = public;
alter function public.parc_pix_mascarado(text) set search_path = public;
alter function public.parc_status_indicacao(text, timestamp with time zone, date, date) set search_path = public;
