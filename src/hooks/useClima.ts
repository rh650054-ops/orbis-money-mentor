/* ============================================================
   useClima — pega a posição (GPS ou a última conhecida), chama a função
   clima-vendedor e guarda a resposta no aparelho por 30 min (o tempo) e
   por dia (a opinião da IA), pra não gastar IA a cada abertura.
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
export interface ContextoClima { meta?: number; vendidoHoje?: number; melhorHora?: number | null; contas?: { nome: string; dias: number; valor: number }[]; quedaChuvaPct?: number | null }
interface Resposta { tempo: Tempo; opiniao: Opiniao | null; fonteOpiniao: "ia" | "local" | "nenhuma"; atualizadoEm: string; cell: string }

const K_TEMPO = "orbis_clima_tempo_v1";
const K_OPINIAO = "orbis_clima_opiniao_v1";
const TTL_TEMPO = 30 * 60 * 1000;

function lerCache<T>(k: string): (T & { ts: number }) | null {
  try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T & { ts: number }) : null; } catch { return null; }
}
function gravarCache(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

/** Posição: GPS se der (até 6 s), senão a última posição guardada (24 h). */
function pegarPosicao(): Promise<{ lat: number; lon: number; origem: "gps" | "ultima" } | null> {
  return new Promise((resolve) => {
    const ult = getUltimaPosicao(24 * 3600 * 1000);
    if (!("geolocation" in navigator)) return resolve(ult ? { lat: ult.lat, lon: ult.lng, origem: "ultima" } : null);
    let done = false;
    const fim = (v: { lat: number; lon: number; origem: "gps" | "ultima" } | null) => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      (p) => { setUltimaPosicao(p.coords.latitude, p.coords.longitude); fim({ lat: p.coords.latitude, lon: p.coords.longitude, origem: "gps" }); },
      () => fim(ult ? { lat: ult.lat, lon: ult.lng, origem: "ultima" } : null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 10 * 60 * 1000 },
    );
    setTimeout(() => fim(ult ? { lat: ult.lat, lon: ult.lng, origem: "ultima" } : null), 6500);
  });
}

export function useClima(opts: { contexto?: ContextoClima; comOpiniao?: boolean; auto?: boolean } = {}) {
  const { contexto, comOpiniao = true, auto = true } = opts;
  const [tempo, setTempo] = useState<Tempo | null>(() => { const c = lerCache<{ tempo: Tempo }>(K_TEMPO); return c ? c.tempo : null; });
  const [opiniao, setOpiniao] = useState<Opiniao | null>(() => {
    const c = lerCache<{ opiniao: Opiniao; dia: string; estado: string }>(K_OPINIAO);
    return c && c.dia === getBrazilDate() ? c.opiniao : null;
  });
  const [fonteOpiniao, setFonteOpiniao] = useState<"ia" | "local" | "nenhuma" | "cache">("nenhuma");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<"sem_posicao" | "falhou" | null>(null);

  const carregar = useCallback(async (forcarOpiniao = false) => {
    setCarregando(true); setErro(null);
    try {
      const pos = await pegarPosicao();
      if (!pos) { setErro("sem_posicao"); return; }
      const cTempo = lerCache<{ tempo: Tempo }>(K_TEMPO);
      const cOp = lerCache<{ opiniao: Opiniao; dia: string; estado: string }>(K_OPINIAO);
      const tempoFresco = cTempo && Date.now() - cTempo.ts < TTL_TEMPO ? cTempo.tempo : null;
      const opiniaoDoDia = cOp && cOp.dia === getBrazilDate() && (!tempoFresco || cOp.estado === tempoFresco.estado) ? cOp.opiniao : null;
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
        gravarCache(K_OPINIAO, { opiniao: r.opiniao, dia: getBrazilDate(), estado: r.tempo.estado, ts: Date.now() });
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

  return { tempo, opiniao, fonteOpiniao, carregando, erro, recarregar: () => carregar(true) };
}
