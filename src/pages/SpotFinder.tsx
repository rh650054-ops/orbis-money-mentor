/* ============================================================
   CAÇA-SINAL v2 (Rick, 07/09)
   - "Sinais perto de mim": GPS → RPC caca_sinais_quentes (semáforos reais +
     vendas reais compartilhadas, agregadas com 3+ vendedores).
   - Sem GPS: cidade do perfil → centro pela média dos semáforos JÁ no banco.
   - Nomes dos cruzamentos: já vêm do banco (job de fundo nomear-sinais).
   - ZERO chamada a serviço externo no app (Rick, 07/09): só banco + GPS do aparelho.
   - Inteligência: "agora" (melhor sinal pra hora atual), "seu melhor ponto"
     (histórico próprio via caca_sinal_meus), tempo do sinal pela comunidade.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Radar, Navigation, LocateFixed, Flame, Loader2, Clock, MapPin, Check, Download, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { getUltimaPosicao, setUltimaPosicao } from "@/shared/lib/gps-last";
import SpotMap from "@/components/spotfinder/SpotMap";
import { nomeDoSinal } from "@/components/defcon/DefconSinalSheet";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

type Sinal = {
  osm_id: number; lat: number; lng: number; vias: string | null;
  distancia_km: number; densidade: number;
  vendedores: number; sessoes: number; total: number | null; minutos: number | null; rs_hora: number | null;
  horas: number[] | null; bom: number; medio: number; ruim: number;
  duracao: "curto" | "medio" | "longo" | null; duracao_votos: number; score: number;
};
type Meu = { osm_id: number; lat: number | null; lng: number | null; vias: string | null; dias: number; total: number; minutos: number; rs_hora: number | null; melhor_dia_semana: number | null; melhor_hora: number | null; ultima_data: string };

const DIAS_SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DUR_LABEL: Record<string, string> = { curto: "Sinal curto · até 30s", medio: "Sinal médio · 30–60s", longo: "Sinal longo · +60s" };
const RAIOS = [2, 5, 10];

function picos(horas: number[] | null): string | null {
  if (!horas || horas.length < 24) return null;
  const total = horas.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const idx = horas.map((v, i) => ({ v, i })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.i).sort((a, b) => a - b);
  return idx.map((h) => `${h}h–${h + 1}h`).join(" e ");
}

/* Linha de cada sinal — fora do componente pai (regra do foco). */
function CardSinal({ s, pos, onDuracao, onJaVendi }: {
  s: Sinal; pos: number;
  onDuracao: (osm: number, d: "curto" | "medio" | "longo") => void;
  onJaVendi: (s: Sinal) => void;
}) {
  const quente = s.rs_hora != null && s.vendedores >= 3;
  const [aberto, setAberto] = useState(pos <= 2);
  const pico = picos(s.horas);
  const barras = s.horas ? s.horas.slice(6, 21) : null; // 6h..20h
  const maxBarra = barras ? Math.max(1, ...barras) : 1;
  return (
    <div id={`sinal-${s.osm_id}`} className="rounded-[18px] p-3.5" style={{ background: "#0e0e10", border: `1px solid ${quente ? `${HOT}66` : "#22201a"}`, boxShadow: quente ? `0 0 22px ${HOT}14` : undefined }}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full text-left flex gap-2.5 items-start">
        <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-xs font-black shrink-0"
          style={quente ? { background: "#2a1205", border: `1px solid ${HOT}66`, color: "#ff9d4d" } : s.vendedores > 0 ? { background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" }}>
          {pos}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="text-[15px] font-black tracking-tight leading-tight text-foreground">{nomeDoSinal(s)}</span>
            <span className="text-[11px] whitespace-nowrap mt-0.5" style={{ color: "#8a8378" }}>{s.distancia_km.toFixed(1).replace(".", ",")} km</span>
          </span>
          <span className="block text-[11px] mt-0.5" style={{ color: "#8a8378" }}>{s.densidade} semáforo{s.densidade === 1 ? "" : "s"} em 300 m</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 mt-1 transition-transform" style={{ color: "#8a8378", transform: aberto ? "rotate(180deg)" : undefined }} />
      </button>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {quente && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "#2a0c11", border: "1px solid rgba(242,70,90,.4)", color: "#ff7d8c" }}>
            <Flame className="w-3 h-3" strokeWidth={2.5} /> QUENTE
          </span>
        )}
        {s.rs_hora != null ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            <b style={{ color: OK }}>{formatCurrency(s.rs_hora)}/h</b>&nbsp;média de quem vendeu aqui
          </span>
        ) : s.vendedores > 0 ? (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            {s.vendedores} vendedor{s.vendedores === 1 ? "" : "es"} testou · faltam {Math.max(0, 3 - s.vendedores)} pra abrir os números
          </span>
        ) : (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#b3ab9c" }}>
            Ninguém do Orbis vendeu aqui ainda
          </span>
        )}
        {s.vendedores >= 3 && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            {s.vendedores} vendedores · {s.sessoes} dia{s.sessoes === 1 ? "" : "s"}
          </span>
        )}
        {s.bom + s.ruim + s.medio > 0 && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: s.bom >= s.ruim ? "#0d1f16" : "#2a0c11", border: `1px solid ${s.bom >= s.ruim ? "rgba(61,214,140,.35)" : "rgba(242,70,90,.4)"}`, color: s.bom >= s.ruim ? OK : "#ff7d8c" }}>
            {s.bom >= s.ruim ? "bom" : "ruim"} · {s.bom + s.medio + s.ruim} avaliaç{s.bom + s.medio + s.ruim === 1 ? "ão" : "ões"}
          </span>
        )}
        {s.duracao && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>
            <Clock className="w-3 h-3" /> {DUR_LABEL[s.duracao]}{s.duracao_votos > 1 ? ` · ${s.duracao_votos} relatos` : ""}
          </span>
        )}
      </div>

      {aberto && (
        <>
          {barras && (
            <div className="mt-3">
              <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>MELHORES HORAS (VENDAS REAIS)</p>
              <div className="flex gap-[3px] items-end h-[30px] mt-2">
                {barras.map((v, i) => {
                  const h = Math.max(8, Math.round((v / maxBarra) * 100));
                  const top = v > 0 && v >= maxBarra * 0.9;
                  const alto = v > 0 && v >= maxBarra * 0.6;
                  return <i key={i} className="flex-1 rounded-[2px]" style={{ height: `${h}%`, background: top ? HOT : alto ? GOLD : "#1c1b20" }} />;
                })}
              </div>
              <div className="flex justify-between text-[9px] font-bold mt-1" style={{ color: "#8a8378" }}><span>6h</span><span>9h</span><span>12h</span><span>15h</span><span>18h</span><span>20h</span></div>
              {pico && <p className="text-[11px] mt-1.5" style={{ color: "#8a8378" }}>Pico <b className="text-foreground">{pico}</b></p>}
            </div>
          )}

          {!s.duracao && (
            <div className="mt-3 rounded-[12px] px-3 py-2.5" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
              <p className="text-[11px] font-bold" style={{ color: "#b3ab9c" }}>Quanto tempo esse sinal fica fechado?</p>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {([["curto", "Curto"], ["medio", "Médio"], ["longo", "Longo"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => onDuracao(s.osm_id, k)} className="h-8 rounded-lg text-[11px] font-black active:scale-95 transition-transform" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>{l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank")}
              className="flex-1 h-10 rounded-[11px] flex items-center justify-center gap-1.5 text-xs font-black active:scale-[0.98] transition-transform" style={{ background: GOLD, color: "#1a1305" }}>
              <Navigation className="w-3.5 h-3.5" strokeWidth={2.6} /> IR AGORA
            </button>
            <button type="button" onClick={() => onJaVendi(s)}
              className="flex-1 h-10 rounded-[11px] flex items-center justify-center gap-1.5 text-xs font-black active:scale-[0.98] transition-transform" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              <Check className="w-3.5 h-3.5" strokeWidth={2.6} /> Já vendi aqui
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SpotFinder() {
  const { user } = useAuth();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";
  const { toast } = useToast();

  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [raio, setRaio] = useState(5);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [origem, setOrigem] = useState<"gps" | "cidade" | null>(null);
  const [loading, setLoading] = useState(false);
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [meus, setMeus] = useState<Meu[]>([]);
  const [naRua, setNaRua] = useState(0);
  const [nota, setNota] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cidades, setCidades] = useState<{ cidade: string; uf: string; total: number }[]>([]);
  const [mostrarCidades, setMostrarCidades] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("city, state").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data?.city) setCity(data.city);
      if (data?.state) setUf(data.state);
    });
    (supabase as any).rpc("caca_cidades").then(({ data }: any) => setCidades((data as any[]) || []));
    (supabase as any).rpc("caca_sinal_meus").then(({ data }: any) => setMeus(((data as Meu[]) || []).map((m) => ({ ...m, rs_hora: m.rs_hora != null ? Number(m.rs_hora) : null, total: Number(m.total) }))));
    // quantos vendedores estão no DEFCON agora (últimos 15 min)
    supabase.from("user_presence").select("user_id", { count: "exact", head: true }).gte("last_active_at", new Date(Date.now() - 15 * 60000).toISOString())
      .then(({ count }: any) => setNaRua(count || 0));
  }, [user]);

  const carregar = async (c: { lat: number; lng: number }, r: number) => {
    setLoading(true);
    setNota(null);
    try {
      const { data } = await (supabase as any).rpc("caca_sinais_quentes", { p_lat: c.lat, p_lng: c.lng, p_raio_km: r });
      let lista = ((data as any[]) || []) as Sinal[];
      lista = lista.map((s) => ({
        ...s, distancia_km: Number(s.distancia_km), score: Number(s.score),
        rs_hora: s.rs_hora != null ? Number(s.rs_hora) : null, total: s.total != null ? Number(s.total) : null,
      }));
      setSinais(lista);
      if (lista.length === 0) setNota("Nenhum semáforo mapeado por aqui ainda. Tente um raio maior ou escolha uma cidade já mapeada.");
    } catch (e: any) {
      toast({ title: "Erro ao buscar sinais", description: e?.message ?? "Tente de novo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pertoDeMim = () => {
    if (!("geolocation" in navigator)) { buscarPorCidade(); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUltimaPosicao(c.lat, c.lng);
        setCenter(c); setOrigem("gps");
        carregar(c, raio);
      },
      () => {
        const ult = getUltimaPosicao(24 * 3600 * 1000);
        if (ult) { const c = { lat: ult.lat, lng: ult.lng }; setCenter(c); setOrigem("gps"); carregar(c, raio); return; }
        setLoading(false);
        toast({ title: "Sem GPS agora", description: "Buscando pela sua cidade." });
        buscarPorCidade();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const buscarPorCidadeCom = async (c0: string, u0: string) => {
    setCity(c0); setUf(u0);
    setLoading(true);
    try {
      const { data } = await (supabase as any).rpc("caca_cidade_centro", { p_city: c0, p_uf: u0 });
      const row = (data as any[])?.[0];
      if (!row) { setLoading(false); setNota(`${c0} ainda não está mapeada.`); return; }
      const c = { lat: Number(row.lat), lng: Number(row.lng) };
      setCenter(c); setOrigem("cidade");
      await carregar(c, raio);
    } catch { setLoading(false); }
  };

  const buscarPorCidade = async () => {
    if (!city || !uf) { setMostrarCidades(true); toast({ title: "Escolhe uma cidade da lista ou usa o GPS" }); return; }
    setLoading(true);
    try {
      const { data } = await (supabase as any).rpc("caca_cidade_centro", { p_city: city, p_uf: uf });
      const row = (data as any[])?.[0];
      if (!row) {
        setLoading(false);
        setNota(`${city} ainda não está mapeada no Caça-Sinal. Use o GPS ou escolha uma cidade da lista.`);
        setMostrarCidades(true);
        return;
      }
      const c = { lat: Number(row.lat), lng: Number(row.lng) };
      setCenter(c); setOrigem("cidade");
      await carregar(c, raio);
    } catch (e: any) {
      setLoading(false);
      toast({ title: "Erro", description: e?.message ?? "Falha ao buscar", variant: "destructive" });
    }
  };

  const mudarRaio = (r: number) => { setRaio(r); if (center) carregar(center, r); };

  const informarDuracao = async (osm: number, d: "curto" | "medio" | "longo") => {
    if (!user) return;
    await (supabase as any).from("caca_sinal_duracoes").upsert({ user_id: user.id, osm_id: osm, duracao: d }, { onConflict: "user_id,osm_id" });
    setSinais((prev) => prev.map((s) => (s.osm_id === osm ? { ...s, duracao: s.duracao ?? d, duracao_votos: s.duracao_votos + 1 } : s)));
    toast({ title: "Valeu! Tempo do sinal registrado." });
  };

  // "Já vendi aqui": liga o último DEFCON encerrado (3 dias) sem ponto a este sinal.
  const jaVendi = async (s: Sinal) => {
    if (!user) return;
    const desde = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const { data: sess } = await supabase.from("challenge_sessions").select("id, date, total_sold")
      .eq("user_id", user.id).in("status", ["completed", "abandoned"]).is("sinal_osm_id", null).gte("date", desde)
      .order("date", { ascending: false }).limit(1);
    const ultima = (sess as any[])?.[0];
    if (!ultima) { toast({ title: "Marque no fim do DEFCON", description: "Quando você encerrar o dia ali, o Orbis pergunta o ponto e guarda seu histórico." }); return; }
    const { data: prof } = await supabase.from("profiles").select("compartilha_pontos").eq("user_id", user.id).maybeSingle();
    const comp = (prof as any)?.compartilha_pontos !== false;
    await supabase.from("challenge_sessions").update({ sinal_osm_id: s.osm_id, sinal_compartilha: comp } as never).eq("id", ultima.id);
    toast({ title: `${nomeDoSinal(s)} ligado ao seu DEFCON de ${String(ultima.date).slice(8, 10)}/${String(ultima.date).slice(5, 7)}`, description: "Entrou no seu histórico." });
    (supabase as any).rpc("caca_sinal_meus").then(({ data }: any) => setMeus(((data as Meu[]) || []).map((m) => ({ ...m, rs_hora: m.rs_hora != null ? Number(m.rs_hora) : null, total: Number(m.total) }))));
  };

  const importSignals = async () => {
    if (!city || !uf) { setMostrarCidades(true); return; }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("importar-semaforos", { body: { city, state: uf, radius_km: Math.max(raio, 10) } });
      if (error) throw error;
      toast({ title: `${data?.total_salvos ?? 0} semáforos importados`, description: `${city}/${uf}` });
      if (center) carregar(center, raio);
    } catch (e: any) {
      toast({ title: "Erro no import", description: e?.message ?? "Falha", variant: "destructive" });
    } finally { setImporting(false); }
  };

  // ===== inteligência =====
  const agora = new Date();
  const h = agora.getHours();
  const melhorAgora = useMemo(() => {
    const cand = sinais.filter((s) => s.horas && s.vendedores >= 3);
    if (!cand.length) return null;
    const val = (s: Sinal) => (s.horas![h] || 0) + (s.horas![(h + 1) % 24] || 0);
    const best = [...cand].sort((a, b) => val(b) - val(a))[0];
    if (!best || val(best) <= 0) return null;
    return best;
  }, [sinais, h]);
  const melhorMeu = meus[0] ?? null;
  const meuHoje = useMemo(() => {
    const d = agora.getDay();
    return meus.find((m) => m.melhor_dia_semana === d) ?? null;
  }, [meus]);

  const hot = sinais.filter((s) => s.rs_hora != null).length;

  return (
    <div className="space-y-3.5 pb-8 max-w-2xl mx-auto">
      {/* cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-black tracking-tight leading-none text-foreground flex items-center gap-2"><Radar className="w-5 h-5" style={{ color: GOLD }} /> Caça-Sinal</h1>
          <p className="text-[11px] mt-1" style={{ color: "#8a8378" }}>Onde os vendedores do Orbis mais vendem</p>
        </div>
        {naRua > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap" style={{ border: "1px solid rgba(61,214,140,.3)", color: OK, background: "#0e0e10" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: OK }} /> {naRua} na rua agora
          </span>
        )}
      </div>

      <button type="button" onClick={pertoDeMim} disabled={loading} className="orbis-cta w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: 52 }}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" strokeWidth={2.6} />}
        {loading ? "CAÇANDO SINAIS…" : "SINAIS PERTO DE MIM"}
      </button>

      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <button type="button" onClick={() => setMostrarCidades((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-extrabold" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}>
          <MapPin className="w-3 h-3" /> {city ? `${city}${uf ? ` · ${uf}` : ""}` : "escolher cidade"}
        </button>
        {RAIOS.map((r) => (
          <button key={r} type="button" onClick={() => mudarRaio(r)} className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
            style={raio === r ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            {r} km
          </button>
        ))}
      </div>

      {mostrarCidades && (
        <div className="rounded-[18px] p-3" style={{ background: "#0e0e10", border: "1px solid #22201a" }}>
          <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>CIDADES JÁ MAPEADAS ({cidades.length})</p>
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-40 overflow-y-auto">
            {cidades.map((c) => (
              <button key={`${c.cidade}-${c.uf}`} type="button" onClick={() => { setCity(c.cidade); setUf(c.uf); setMostrarCidades(false); setNota(null); setTimeout(() => buscarPorCidadeCom(c.cidade, c.uf), 0); }}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={city === c.cidade ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
                {c.cidade} · {c.uf}
              </button>
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#8a8378" }}>Sua cidade não está aqui? Toque em <b className="text-foreground">Sinais perto de mim</b> — o GPS resolve — ou peça pro suporte mapear.</p>
        </div>
      )}

      {/* inteligência: agora + seu melhor ponto */}
      {melhorAgora && (
        <div className="rounded-[18px] p-3.5" style={{ background: "linear-gradient(160deg,#2a1205,#0e0e10)", border: `1px solid ${HOT}66` }}>
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#ff9d4d" }}>AGORA · {DIAS_SEM[agora.getDay()].toUpperCase()} {h}H</p>
          <p className="text-sm font-black text-foreground mt-1">{nomeDoSinal(melhorAgora)} é o que mais rende nesse horário</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#b3ab9c" }}>{formatCurrency(melhorAgora.rs_hora!)}/h de média · {melhorAgora.distancia_km.toFixed(1).replace(".", ",")} km de você</p>
        </div>
      )}
      {melhorMeu && melhorMeu.rs_hora != null && (
        <div className="rounded-[18px] p-3.5" style={{ background: "linear-gradient(160deg,#1a1305,#0e0e10)", border: `1px solid ${GOLD}55` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-black text-foreground">Seu melhor ponto</p>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-[.08em]" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}>DO SEU DEFCON</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "#b3ab9c" }}>
            {nomeDoSinal({ vias: melhorMeu.vias, osm_id: melhorMeu.osm_id })} — <b className="text-foreground">{formatCurrency(melhorMeu.rs_hora)}/h</b> em {melhorMeu.dias} dia{melhorMeu.dias === 1 ? "" : "s"}.
            {melhorMeu.melhor_dia_semana != null && melhorMeu.melhor_hora != null && <> {DIAS_SEM[melhorMeu.melhor_dia_semana].charAt(0).toUpperCase() + DIAS_SEM[melhorMeu.melhor_dia_semana].slice(1)} às {melhorMeu.melhor_hora}h é seu melhor horário lá.</>}
            {meuHoje && meuHoje.osm_id !== melhorMeu.osm_id && <> Hoje ({DIAS_SEM[agora.getDay()]}) seu melhor histórico é em <b className="text-foreground">{nomeDoSinal({ vias: meuHoje.vias, osm_id: meuHoje.osm_id })}</b>.</>}
          </p>
        </div>
      )}

      {/* mapa */}
      {!loading && center && sinais.length > 0 && (
        <div className="space-y-1.5">
          <SpotMap
            center={center}
            spots={[
              ...(origem === "gps" ? [{ id: "eu", name: "Você", lat: center.lat, lng: center.lng, me: true }] : []),
              ...sinais.map((s, i) => ({
                id: String(s.osm_id), name: nomeDoSinal(s), lat: s.lat, lng: s.lng, pos: i + 1,
                tom: (s.rs_hora != null && s.vendedores >= 3 ? "quente" : s.vendedores > 0 ? "testado" : "frio") as "quente" | "testado" | "frio",
              })),
            ]}
            signals={[]}
            onSelect={(id) => document.getElementById(`sinal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
          <p className="text-[11px] flex items-center gap-2 px-1 flex-wrap" style={{ color: "#8a8378" }}>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: HOT }} /> quente = vendas reais ({hot})</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: GOLD }} /> top 3</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#3a3629" }} /> só semáforo</span>
            <span>· {origem === "gps" ? "pela sua posição" : `por ${city}`}</span>
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-10 gap-3">
          <Radar className="w-8 h-8 animate-pulse" style={{ color: GOLD }} />
          <p className="text-sm text-center px-4" style={{ color: "#b3ab9c" }}>Cruzando semáforos reais com as vendas dos vendedores do Orbis…</p>
        </div>
      )}

      {nota && !loading && <p className="text-xs text-center px-4" style={{ color: "#b3ab9c" }}>{nota}</p>}

      {/* lista */}
      {!loading && user && sinais.map((s, i) => (
        <CardSinal key={s.osm_id} s={s} pos={i + 1} onDuracao={informarDuracao} onJaVendi={jaVendi} />
      ))}

      {!loading && sinais.length === 0 && !center && (
        <div className="rounded-[18px] p-5 text-center" style={{ background: "#0e0e10", border: "1px solid #22201a" }}>
          <p className="text-sm text-foreground font-bold">Toque em <span style={{ color: GOLD }}>Sinais perto de mim</span></p>
          <p className="text-[11px] mt-1" style={{ color: "#8a8378" }}>O Orbis cruza os semáforos reais da sua região com onde os vendedores mais vendem. Quanto mais gente marca o ponto no fim do DEFCON, mais esperto ele fica.</p>
        </div>
      )}

      {isAdmin && (
        <button type="button" onClick={importSignals} disabled={importing} className="w-full h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5" style={{ color: "#8a8378", border: "1px dashed #2a2823" }}>
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {importing ? "Importando semáforos…" : "Importar semáforos desta cidade (admin)"}
        </button>
      )}
    </div>
  );
}
