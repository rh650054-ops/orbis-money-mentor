/* ============================================================
   useClima — pega a posição (GPS ou a última conhecida), chama a função
   clima-vendedor e guarda a resposta no aparelho por 30 min (o tempo) e
   por FAIXA DO DIA (a opinião da IA), pra não gastar IA a cada abertura
   sem deixar conselho de madrugada aparecendo de manhã.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { getUltimaPosicao, setUltimaPosicao } from "@/shared/lib/gps-last";
import type { Estado } from "@/components/clima/ClimaCena";

export interface HoraClima { hora: number; iso: string; fontes: number; total: number; mm: number; temp: number | null; prob: number | null; codigo: number | null }
export interface Tempo {
  estado: Estado; temp: number; sensacao: number; max: number | null; min: number | null; vento: number; rajada: number | null;
  condicao: string; codigo: number; ehDia: boolean; horas: HoraClima[]; fontesTotal: number; fontesOk: string[]; concordancia: number;
  alerta: { titulo: string; texto: string } | null; chuva: { proxima: number | null; ate: number | null; fontes: number } | null;
  cidade: string; uf: string;
}
export interface Opiniao { falas: string[]; veredito: { titulo: string; sub: string; nota: number }; sair: { hora: string; txt: string }; pausa: { hora: string; txt: string }; volta: { hora: string; txt: string } }
export interface ContextoClima { meta?: number; vendidoHoje?: number; melhorHora?: number | null; melhoresHoras?: number[]; contas?: { nome: string; dias: number; valor: number }[]; quedaChuvaPct?: number | null }
interface Resposta { tempo: Tempo; opiniao: Opiniao | null; fonteOpiniao: "ia" | "local" | "nenhuma"; atualizadoEm: string; cell: string }

const K_TEMPO = "orbis_clima_tempo_v1";
const K_OPINIAO = "orbis_clima_opiniao_v2";
const TTL_TEMPO = 30 * 60 * 1000;

/* Faixa do dia no fuso de Brasília. A opinião vale por FAIXA, não pelo dia
   inteiro: a que o Orbis deu de madrugada ("vai dormir") não pode continuar
   na tela às 9 da manhã. (Rick, 11/09) */
function periodoBR(): "madrugada" | "manha" | "tarde" | "noite" {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 5 ? "madrugada" : h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}

function lerCache<T>(k: string): (T & { ts: number }) | null {
  try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T & { ts: number }) : null; } catch { return null; }
}
function gravarCache(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

/* ============================================================
   PERMISSÃO DE LOCALIZAÇÃO (Rick, 11/09)
   Antes o app chamava o GPS na abertura e o celular jogava aquele pop-up
   cinza na cara do vendedor TODA vez. Agora a gente pergunta ANTES qual é
   o estado da permissão e só encosta no GPS quando já está liberado — ou
   quando a pessoa toca no nosso card. O pop-up do sistema aparece uma vez.
   ============================================================ */
export type Permissao = "liberada" | "perguntar" | "negada" | "sem_gps";
const K_JA_LIBEROU = "orbis_clima_gps_ok"; // plano B pra navegador sem a API de permissões (iOS antigo)

export async function estadoPermissao(): Promise<Permissao> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "sem_gps";
  try {
    const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (st?.state === "granted") return "liberada";
    if (st?.state === "denied") return "negada";
    if (st?.state === "prompt") return "perguntar";
  } catch { /* Safari antigo não tem: cai no plano B */ }
  try { if (localStorage.getItem(K_JA_LIBEROU) === "1") return "liberada"; } catch { /* ignore */ }
  return "perguntar";
}

/** Chama o GPS de verdade. É AQUI que o pop-up do sistema aparece — só no toque do vendedor. */
function lerGps(timeout = 8000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    let done = false;
    const fim = (v: { lat: number; lon: number } | null) => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUltimaPosicao(p.coords.latitude, p.coords.longitude);
        try { localStorage.setItem(K_JA_LIBEROU, "1"); } catch { /* ignore */ }
        fim({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => fim(null),
      { enableHighAccuracy: false, timeout, maximumAge: 10 * 60 * 1000 },
    );
    setTimeout(() => fim(null), timeout + 500);
  });
}

/** Posição sem incomodar: usa o GPS só se já estiver liberado; senão, a última conhecida (24 h). */
async function pegarPosicao(): Promise<{ lat: number; lon: number } | null> {
  const ult = getUltimaPosicao(24 * 3600 * 1000);
  const perm = await estadoPermissao();
  if (perm === "liberada") {
    const p = await lerGps(6000);
    if (p) return p;
  }
  return ult ? { lat: ult.lat, lon: ult.lng } : null;
}

export function useClima(opts: { contexto?: ContextoClima; comOpiniao?: boolean; auto?: boolean } = {}) {
  const { contexto, comOpiniao = true, auto = true } = opts;
  const [tempo, setTempo] = useState<Tempo | null>(() => { const c = lerCache<{ tempo: Tempo }>(K_TEMPO); return c ? c.tempo : null; });
  const [opiniao, setOpiniao] = useState<Opiniao | null>(() => {
    const c = lerCache<{ opiniao: Opiniao; dia: string; periodo: string; estado: string }>(K_OPINIAO);
    return c && c.dia === getBrazilDate() && c.periodo === periodoBR() ? c.opiniao : null;
  });
  const [fonteOpiniao, setFonteOpiniao] = useState<"ia" | "local" | "nenhuma" | "cache">("nenhuma");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<"sem_posicao" | "falhou" | null>(null);
  const [permissao, setPermissao] = useState<Permissao | null>(null);

  useEffect(() => { void estadoPermissao().then(setPermissao); }, []);

  /* Chamado pelo BOTÃO do nosso card. É o único lugar que faz o celular
     perguntar — e, se a pessoa liberar, já carrega o clima na sequência. */
  const pedirPermissao = useCallback(async () => {
    setCarregando(true);
    const p = await lerGps(10000);
    const st = await estadoPermissao();
    setPermissao(p ? "liberada" : st);
    setCarregando(false);
    return !!p;
  }, []);

  const carregar = useCallback(async (forcarOpiniao = false) => {
    setCarregando(true); setErro(null);
    try {
      const pos = await pegarPosicao();
      if (!pos) { setErro("sem_posicao"); setPermissao(await estadoPermissao()); return; }
      const cTempo = lerCache<{ tempo: Tempo }>(K_TEMPO);
      const cOp = lerCache<{ opiniao: Opiniao; dia: string; periodo: string; estado: string }>(K_OPINIAO);
      const tempoFresco = cTempo && Date.now() - cTempo.ts < TTL_TEMPO ? cTempo.tempo : null;
      const opiniaoDoDia = cOp && cOp.dia === getBrazilDate() && cOp.periodo === periodoBR() && (!tempoFresco || cOp.estado === tempoFresco.estado) ? cOp.opiniao : null;
      // tudo em cache e ninguém forçou? não gasta nada.
      if (tempoFresco && (!comOpiniao || opiniaoDoDia) && !forcarOpiniao) {
        setTempo(tempoFresco); if (opiniaoDoDia) { setOpiniao(opiniaoDoDia); setFonteOpiniao("cache"); }
        return;
      }
      const precisaOpiniao = comOpiniao && (forcarOpiniao || !opiniaoDoDia);
      const { data, error } = await supabase.functions.invoke("clima-vendedor", {
        body: { lat: pos.lat, lon: pos.lon, contexto: contexto ?? {}, semIA: !precisaOpiniao },
      });
      if (error || !data || (data as { error?: string }).error) throw new Error((data as { error?: string })?.error || String(error));
      const r = data as Resposta;
      setTempo(r.tempo); gravarCache(K_TEMPO, { tempo: r.tempo, ts: Date.now() });
      if (r.opiniao) {
        setOpiniao(r.opiniao); setFonteOpiniao(r.fonteOpiniao);
        gravarCache(K_OPINIAO, { opiniao: r.opiniao, dia: getBrazilDate(), periodo: periodoBR(), estado: r.tempo.estado, ts: Date.now() });
      } else if (opiniaoDoDia) { setOpiniao(opiniaoDoDia); setFonteOpiniao("cache"); }
    } catch (e) {
      console.error("useClima:", e);
      setErro("falhou");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comOpiniao, JSON.stringify(contexto ?? {})]);

  useEffect(() => { if (auto) void carregar(false); }, [auto, carregar]);

  return {
    tempo, opiniao, fonteOpiniao, carregando, erro, permissao,
    recarregar: () => carregar(true),
    pedirPermissao: async () => { const ok = await pedirPermissao(); if (ok) await carregar(true); return ok; },
  };
}
