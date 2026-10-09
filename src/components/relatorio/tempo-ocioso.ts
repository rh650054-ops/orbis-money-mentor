/* TEMPO OCIOSO do relatório (corrigido 09/10, Mohamed: "tempo ocioso estava bem bugado").
   Antes: soma de challenge_sessions.paused_seconds, um contador que o app vai
   somando. Ele contava a MESMA pausa duas vezes quando o app recarregava no
   meio dela, ou quando o Foco estava aberto em dois aparelhos (ex.: Mohamed
   07/10: 193 min de ocioso, com 144 min de pausas de verdade).
   Agora: as pausas registradas (defcon_pausas), com as que se sobrepõem
   juntadas numa só, e nunca mais que o tempo do dia que não foi trabalho
   (fim − início − trabalhado). Sessão antiga, sem pausas registradas, usa o
   contador antigo com o mesmo teto. */

export interface SessaoOcio {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  worked_minutes?: number | null;
  paused_seconds?: number | null;
}

export interface PausaOcio {
  session_id: string | null;
  inicio: string;
  fim: string | null;
  segundos: number | null;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** Segundos de pausa de verdade numa sessão: intervalos juntados, sem contar duas vezes. */
export function segundosDePausa(pausas: PausaOcio[], fimSessao: number): number {
  const ints = pausas
    .map((p) => {
      const ini = ms(p.inicio);
      let fim = ms(p.fim);
      if (!Number.isFinite(fim) && p.segundos != null) fim = ini + p.segundos * 1000;
      if (!Number.isFinite(fim)) fim = fimSessao;
      return [ini, Math.min(fim, fimSessao)] as [number, number];
    })
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const it of ints) {
    if (cur && it[0] <= cur[1]) cur[1] = Math.max(cur[1], it[1]);
    else { if (cur) total += cur[1] - cur[0]; cur = [it[0], it[1]]; }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / 1000);
}

/** Minutos ociosos de uma sessão. */
export function minutosOciosos(s: SessaoOcio, pausas: PausaOcio[], agora = Date.now()): number {
  const ini = ms(s.started_at);
  const fim = Number.isFinite(ms(s.ended_at)) ? ms(s.ended_at) : agora;
  const daSessao = pausas.filter((p) => p.session_id === s.id);
  const seg = daSessao.length > 0 ? segundosDePausa(daSessao, fim) : Math.max(0, Number(s.paused_seconds) || 0);
  let min = seg / 60;
  if (Number.isFinite(ini) && fim > ini && typeof s.worked_minutes === "number") {
    const teto = Math.max(0, (fim - ini) / 60000 - s.worked_minutes);
    min = Math.min(min, teto);
  }
  return Math.max(0, Math.round(min));
}

export function minutosOciososDoPeriodo(sessoes: SessaoOcio[], pausas: PausaOcio[], agora = Date.now()): number {
  return sessoes.reduce((t, s) => t + minutosOciosos(s, pausas, agora), 0);
}
