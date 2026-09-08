/* ============================================================
   CAÇA-SINAL v3 (Rick, 08/09)
   - Busca por CIDADE (lista das mapeadas) + LUGAR (rua/avenida/bairro) — tudo
     dentro do próprio banco (caca_buscar_lugar). ZERO serviço externo no app.
   - "Perto de mim": GPS → RPC caca_sinais_quentes (semáforos reais + vendas
     reais compartilhadas, agregadas com 3+ vendedores).
   - Card com medalha + 3 blocos fixos: SEMÁFOROS · TEMPO DO SINAL · VENDEDORES/R$-h.
     Tempo do sinal sempre visível; sem relato, os 3 botões ficam ali mesmo.
   - Inteligência: "agora" e "seu melhor ponto" (histórico próprio).
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Navigation, LocateFixed, Flame, Loader2, MapPin, Search, Check, Download, ChevronDown, Trophy, X } from "lucide-react";
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

type Duracao = "curto" | "medio" | "longo";
type Sinal = {
  osm_id: number; lat: number; lng: number; vias: string | null;
  distancia_km: number; densidade: number;
  vendedores: number; sessoes: number; total: number | null; minutos: number | null; rs_hora: number | null;
  horas: number[] | null; bom: number; medio: number; ruim: number;
  duracao: Duracao | null; duracao_votos: number; score: number;
};
type Meu = { osm_id: number; lat: number | null; lng: number | null; vias: string | null; dias: number; total: number; minutos: number; rs_hora: number | null; melhor_dia_semana: number | null; melhor_hora: number | null; ultima_data: string };
type Cidade = { cidade: string; uf: string; total: number };

const DIAS_SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DUR: Record<Duracao, { l: string; s: string }> = { curto: { l: "Curto", s: "até 30s" }, medio: { l: "Médio", s: "30–60s" }, longo: { l: "Longo", s: "+60s" } };
const RAIOS = [2, 5, 10];

function picos(horas: number[] | null): string | null {
  if (!horas || horas.length < 24) return null;
  const total = horas.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const idx = horas.map((v, i) => ({ v, i })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.i).sort((a, b) => a - b);
  return idx.map((h) => `${h}h–${h + 1}h`).join(" e ");
}

/* ---------- Medalha do ranking (ouro/prata/bronze/neutra) ---------- */
function Medalha({ pos }: { pos: number }) {
  const est =
    pos === 1 ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1305", boxShadow: "0 4px 0 #B88700" }
    : pos === 2 ? { background: "linear-gradient(180deg,#e6eeff,#9FB2CC)", color: "#1a1305", boxShadow: "0 4px 0 #6f7f95" }
    : pos === 3 ? { background: "linear-gradient(180deg,#e0a06a,#CD7F45)", color: "#1a1305", boxShadow: "0 4px 0 #8a5227" }
    : { background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" };
  return <span className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-[14px] font-black shrink-0" style={est}>{pos}</span>;
}

/* ---------- Card de cada sinal (fora do pai: regra do foco) ---------- */
function CardSinal({ s, pos, cidade, onDuracao, onJaVendi }: {
  s: Sinal; pos: number; cidade: string;
  onDuracao: (osm: number, d: Duracao) => void;
  onJaVendi: (s: Sinal) => void;
}) {
  const quente = s.rs_hora != null && s.vendedores >= 3;
  const top = pos <= 3;
  const [aberto, setAberto] = useState(pos <= 2);
  const pico = picos(s.horas);
  const barras = s.horas ? s.horas.slice(6, 21) : null;
  const maxBarra = barras ? Math.max(1, ...barras) : 1;
  const nAval = s.bom + s.medio + s.ruim;

  const cardStyle = quente
    ? { background: "linear-gradient(170deg,#1a1006 0%,#0e0e10 60%)", border: `1px solid ${HOT}66`, boxShadow: `0 0 28px ${HOT}14` }
    : top
    ? { background: "linear-gradient(170deg,#151004 0%,#0e0e10 60%)", border: "1px solid rgba(245,184,0,.4)" }
    : { background: "#0e0e10", border: "1px solid #22201a" };

  return (
    <div id={`sinal-${s.osm_id}`} className="rounded-[20px] p-3.5" style={cardStyle}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full text-left flex gap-2.5 items-start">
        <Medalha pos={pos} />
        <span className="flex-1 min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="text-[15px] font-black tracking-tight leading-tight text-foreground">{nomeDoSinal(s)}</span>
            {quente && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black shrink-0 mt-0.5" style={{ background: "#2a0c11", border: "1px solid rgba(242,70,90,.4)", color: "#ff7d8c" }}>
                <Flame className="w-3 h-3" strokeWidth={2.5} /> QUENTE
              </span>
            )}
          </span>
          <span className="block text-[11px] mt-0.5" style={{ color: "#8a8378" }}>
            {cidade ? `${cidade} · ` : ""}<b className="text-foreground">{s.distancia_km.toFixed(1).replace(".", ",")} km</b> de você
          </span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 mt-1 transition-transform" style={{ color: "#8a8378", transform: aberto ? "rotate(180deg)" : undefined }} />
      </button>

      {/* 3 blocos fixos */}
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        <div className="rounded-xl px-2 py-2 text-center" style={{ background: "#0a0a0d", border: "1px solid #22201a" }}>
          <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>SEMÁFOROS</p>
          <p className="text-[13px] font-black mt-0.5 text-foreground">{s.densidade} <span className="text-[9px] font-bold" style={{ color: "#8a8378" }}>em 300 m</span></p>
        </div>

        {s.duracao ? (
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "#1a1305", border: "1px solid #3a2f0c" }}>
            <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>TEMPO DO SINAL</p>
            <p className="text-[13px] font-black mt-0.5" style={{ color: GOLD }}>{DUR[s.duracao].l}</p>
            <p className="text-[9px] font-black" style={{ color: "#c9a227" }}>{DUR[s.duracao].s} · {s.duracao_votos} relato{s.duracao_votos === 1 ? "" : "s"}</p>
          </div>
        ) : (
          <div className="rounded-xl px-1.5 py-2 text-center" style={{ background: "#0a0a0d", border: "1px solid #22201a" }}>
            <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>TEMPO DO SINAL</p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: "#b3ab9c" }}>não medido</p>
            <div className="flex gap-1 mt-1.5">
              {(["curto", "medio", "longo"] as Duracao[]).map((k) => (
                <button key={k} type="button" onClick={() => onDuracao(s.osm_id, k)} className="flex-1 h-[24px] rounded-md text-[9px] font-black active:scale-95 transition-transform" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
                  {DUR[k].l}
                </button>
              ))}
            </div>
          </div>
        )}

        {s.rs_hora != null ? (
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "#0d1f16", border: "1px solid rgba(61,214,140,.3)" }}>
            <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>R$/HORA</p>
            <p className="text-[13px] font-black mt-0.5 tabular-nums" style={{ color: OK }}>{formatCurrency(s.rs_hora)}</p>
            <p className="text-[9px] font-black" style={{ color: "#2f9e6a" }}>{s.vendedores} vendedores</p>
          </div>
        ) : (
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "#0a0a0d", border: "1px solid #22201a" }}>
            <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>VENDEDORES</p>
            <p className="text-[13px] font-black mt-0.5 text-foreground">{s.vendedores}</p>
            {s.vendedores > 0 && <p className="text-[9px] font-bold" style={{ color: "#8a8378" }}>faltam {Math.max(0, 3 - s.vendedores)} p/ abrir R$/h</p>}
          </div>
        )}
      </div>

      {s.vendedores === 0 && (
        <div className="mt-2.5 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px]" style={{ background: "#1a1305", border: "1px dashed rgba(245,184,0,.4)", color: "#b3ab9c" }}>
          <Trophy className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
          <span>Ninguém do Orbis vendeu aqui ainda. <b style={{ color: GOLD }}>Seja o primeiro</b> — marca o ponto no fim do DEFCON.</span>
        </div>
      )}

      {nAval > 0 && (
        <p className="text-[11px] mt-2" style={{ color: s.bom >= s.ruim ? OK : "#ff7d8c" }}>
          {s.bom >= s.ruim ? "Avaliado como bom" : "Avaliado como ruim"} por quem vendeu ({nAval} avaliaç{nAval === 1 ? "ão" : "ões"})
        </p>
      )}

      {aberto && (
        <>
          {barras && (
            <div className="mt-3">
              <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>MELHORES HORAS · VENDAS REAIS</p>
              <div className="flex gap-[3px] items-end h-[28px] mt-2">
                {barras.map((v, i) => {
                  const hh = Math.max(8, Math.round((v / maxBarra) * 100));
                  const t = v > 0 && v >= maxBarra * 0.9;
                  const a = v > 0 && v >= maxBarra * 0.6;
                  return <i key={i} className="flex-1 rounded-[2px]" style={{ height: `${hh}%`, background: t ? HOT : a ? GOLD : "#1c1b20" }} />;
                })}
              </div>
              <div className="flex justify-between text-[9px] font-bold mt-1" style={{ color: "#8a8378" }}><span>6h</span><span>9h</span><span>12h</span><span>15h</span><span>18h</span><span>20h</span></div>
              {pico && <p className="text-[11px] mt-1" style={{ color: "#8a8378" }}>Pico <b className="text-foreground">{pico}</b></p>}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank")}
              className="flex-1 h-[42px] rounded-xl flex items-center justify-center gap-1.5 text-xs font-black active:scale-[0.98] transition-transform" style={{ background: GOLD, color: "#1a1305" }}>
              <Navigation className="w-3.5 h-3.5" strokeWidth={2.6} /> IR AGORA
            </button>
            <button type="button" onClick={() => onJaVendi(s)}
              className="flex-1 h-[42px] rounded-xl flex items-center justify-center gap-1.5 text-xs font-black active:scale-[0.98] transition-transform" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              <Check className="w-3.5 h-3.5" strokeWidth={2.6} /> Já vendi aqui
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Seletor de cidade (folha simples com busca) ---------- */
function SeletorCidade({ cidades, atual, onEscolher, onFechar }: { cidades: Cidade[]; atual: string; onEscolher: (c: Cidade) => void; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = cidades.filter((c) => !q || norm(c.cidade).includes(norm(q)) || norm(c.uf) === norm(q));
  return (
    <div className="rounded-[18px] p-3" style={{ background: "#0e0e10", border: "1px solid #3a2f0c" }}>
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 shrink-0" style={{ color: "#8a8378" }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite a cidade" className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-[#5a5449]" />
        <button type="button" onClick={onFechar} className="p-1" style={{ color: "#8a8378" }}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-44 overflow-y-auto">
        {lista.map((c) => (
          <button key={`${c.cidade}-${c.uf}`} type="button" onClick={() => onEscolher(c)}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={atual === c.cidade ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            {c.cidade} · {c.uf}
          </button>
        ))}
        {lista.length === 0 && <p className="text-[11px] px-1" style={{ color: "#8a8378" }}>Ainda não mapeada. Use o GPS ou peça pro suporte.</p>}
      </div>
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
  const [lugar, setLugar] = useState("");
  const [raio, setRaio] = useState(2);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [origem, setOrigem] = useState<"gps" | "cidade" | "lugar" | null>(null);
  const [origemLabel, setOrigemLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [meus, setMeus] = useState<Meu[]>([]);
  const [naRua, setNaRua] = useState(0);
  const [nota, setNota] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [escolhendoCidade, setEscolhendoCidade] = useState(false);

  const carregarMeus = () =>
    (supabase as any).rpc("caca_sinal_meus").then(({ data }: any) => setMeus(((data as Meu[]) || []).map((m) => ({ ...m, rs_hora: m.rs_hora != null ? Number(m.rs_hora) : null, total: Number(m.total) }))));

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("city, state").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data?.city) setCity(data.city);
      if (data?.state) setUf(data.state);
    });
    (supabase as any).rpc("caca_cidades").then(({ data }: any) => setCidades((data as Cidade[]) || []));
    carregarMeus();
    supabase.from("user_presence").select("user_id", { count: "exact", head: true }).gte("last_active_at", new Date(Date.now() - 15 * 60000).toISOString())
      .then(({ count }: any) => setNaRua(count || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const carregar = async (c: { lat: number; lng: number }, r: number) => {
    setLoading(true);
    setNota(null);
    try {
      const { data } = await (supabase as any).rpc("caca_sinais_quentes", { p_lat: c.lat, p_lng: c.lng, p_raio_km: r });
      const lista = (((data as any[]) || []) as Sinal[]).map((s) => ({
        ...s, distancia_km: Number(s.distancia_km), score: Number(s.score),
        rs_hora: s.rs_hora != null ? Number(s.rs_hora) : null, total: s.total != null ? Number(s.total) : null,
      }));
      setSinais(lista);
      if (lista.length === 0) setNota("Nenhum semáforo mapeado por aqui. Aumenta o raio ou busca por uma avenida principal.");
    } catch (e: any) {
      toast({ title: "Erro ao buscar sinais", description: e?.message ?? "Tente de novo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pertoDeMim = () => {
    if (!("geolocation" in navigator)) { buscar(); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUltimaPosicao(c.lat, c.lng);
        setCenter(c); setOrigem("gps"); setOrigemLabel("pela sua posição");
        carregar(c, raio);
      },
      () => {
        const ult = getUltimaPosicao(24 * 3600 * 1000);
        if (ult) { const c = { lat: ult.lat, lng: ult.lng }; setCenter(c); setOrigem("gps"); setOrigemLabel("pela sua última posição"); carregar(c, raio); return; }
        setLoading(false);
        toast({ title: "Sem GPS agora", description: "Buscando pela sua cidade." });
        buscar();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  // BUSCAR: cidade + lugar (rua/avenida) → centro vem do próprio banco.
  const buscar = async (c0 = city, u0 = uf, termo = lugar) => {
    if (!c0) { setEscolhendoCidade(true); toast({ title: "Escolhe a cidade primeiro" }); return; }
    setLoading(true);
    setNota(null);
    try {
      const t = termo.trim();
      if (t.length >= 3) {
        const { data } = await (supabase as any).rpc("caca_buscar_lugar", { p_city: c0, p_uf: u0, p_termo: t });
        const row = (data as any[])?.[0];
        if (!row) {
          setLoading(false);
          setNota(`Não achei "${t}" em ${c0}. Tenta o nome da avenida ou rua principal do bairro.`);
          return;
        }
        const c = { lat: Number(row.lat), lng: Number(row.lng) };
        setCenter(c); setOrigem("lugar"); setOrigemLabel(`${row.total} sinal${row.total === 1 ? "" : "is"} com "${t}" em ${c0}`);
        await carregar(c, raio);
        return;
      }
      const { data } = await (supabase as any).rpc("caca_cidade_centro", { p_city: c0, p_uf: u0 });
      const row = (data as any[])?.[0];
      if (!row) { setLoading(false); setNota(`${c0} ainda não está mapeada. Use o GPS ou escolha outra cidade.`); setEscolhendoCidade(true); return; }
      const c = { lat: Number(row.lat), lng: Number(row.lng) };
      setCenter(c); setOrigem("cidade"); setOrigemLabel(`centro de ${c0}`);
      await carregar(c, Math.max(raio, 5));
    } catch (e: any) {
      setLoading(false);
      toast({ title: "Erro", description: e?.message ?? "Falha ao buscar", variant: "destructive" });
    }
  };

  const mudarRaio = (r: number) => { setRaio(r); if (center) carregar(center, r); };

  const informarDuracao = async (osm: number, d: Duracao) => {
    if (!user) return;
    await (supabase as any).from("caca_sinal_duracoes").upsert({ user_id: user.id, osm_id: osm, duracao: d }, { onConflict: "user_id,osm_id" });
    setSinais((prev) => prev.map((s) => (s.osm_id === osm ? { ...s, duracao: s.duracao ?? d, duracao_votos: s.duracao_votos + 1 } : s)));
    toast({ title: "Valeu! Tempo do sinal registrado." });
  };

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
    carregarMeus();
  };

  const importSignals = async () => {
    if (!city || !uf) { setEscolhendoCidade(true); return; }
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
    return best && val(best) > 0 ? best : null;
  }, [sinais, h]);
  const melhorMeu = meus[0] ?? null;
  const meuHoje = useMemo(() => meus.find((m) => m.melhor_dia_semana === agora.getDay()) ?? null, [meus]); // eslint-disable-line react-hooks/exhaustive-deps
  const hot = sinais.filter((s) => s.rs_hora != null).length;

  return (
    <div className="space-y-3 pb-8 max-w-2xl mx-auto">
      {/* ===== HERO + BUSCA ===== */}
      <div className="relative overflow-hidden rounded-[22px] px-4 pt-4 pb-4" style={{ background: "radial-gradient(120% 90% at 85% 0%,#2b2006 0%,#120e04 45%,#0b0b0d 100%)", border: "1px solid #3a2f0c" }}>
        <span className="absolute rounded-full pointer-events-none" style={{ right: -40, top: -40, width: 220, height: 220, border: "1px solid rgba(245,184,0,.13)" }} />
        <span className="absolute rounded-full pointer-events-none" style={{ right: -10, top: -10, width: 160, height: 160, border: "1px solid rgba(245,184,0,.2)" }} />
        <span className="absolute rounded-full pointer-events-none" style={{ right: 20, top: 20, width: 100, height: 100, border: "1px solid rgba(245,184,0,.33)" }} />
        <span className="absolute rounded-full pointer-events-none" style={{ right: 66, top: 66, width: 8, height: 8, background: GOLD, boxShadow: `0 0 16px ${GOLD}` }} />

        {naRua > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: "#0d1f16", border: "1px solid rgba(61,214,140,.35)", color: OK }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: OK }} /> {naRua} na rua agora
          </span>
        )}
        <h1 className="text-[26px] font-black tracking-tight leading-none text-foreground mt-2.5">Caça-Sinal</h1>
        <p className="text-xs mt-1.5 max-w-[240px]" style={{ color: "#b3ab9c" }}>Os semáforos onde os vendedores do Orbis mais vendem — com tempo do sinal e melhores horas.</p>

        <div className="mt-3.5 rounded-2xl p-1.5" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
          <button type="button" onClick={() => setEscolhendoCidade((v) => !v)} className="w-full h-[42px] px-3 rounded-xl flex items-center gap-2 text-left">
            <MapPin className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            <span className="text-[10px] font-black tracking-[.12em] w-[52px] shrink-0" style={{ color: "#8a8378" }}>CIDADE</span>
            <span className="flex-1 min-w-0 truncate text-sm font-bold" style={{ color: city ? undefined : "#5a5449" }}>{city ? `${city}${uf ? ` · ${uf}` : ""}` : "escolher cidade"}</span>
            <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#8a8378" }} />
          </button>
          <div className="h-px mx-2" style={{ background: "#1e1c17" }} />
          <div className="h-[42px] px-3 flex items-center gap-2">
            <Search className="w-4 h-4 shrink-0" style={{ color: "#8a8378" }} />
            <span className="text-[10px] font-black tracking-[.12em] w-[52px] shrink-0" style={{ color: "#8a8378" }}>LUGAR</span>
            <input
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
              placeholder="bairro, rua ou avenida"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-foreground placeholder:text-[#5a5449] placeholder:font-medium"
            />
            {lugar && <button type="button" onClick={() => setLugar("")} className="p-1" style={{ color: "#8a8378" }}><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {escolhendoCidade && (
          <div className="mt-2">
            <SeletorCidade cidades={cidades} atual={city} onFechar={() => setEscolhendoCidade(false)}
              onEscolher={(c) => { setCity(c.cidade); setUf(c.uf); setEscolhendoCidade(false); buscar(c.cidade, c.uf, lugar); }} />
          </div>
        )}

        <div className="flex gap-2 mt-2.5">
          <button type="button" onClick={pertoDeMim} disabled={loading} className="orbis-cta flex-1 flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: 48, fontSize: 14 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" strokeWidth={2.6} />}
            PERTO DE MIM
          </button>
          <button type="button" onClick={() => buscar()} disabled={loading} className="h-12 px-4 rounded-[14px] text-[13px] font-black active:scale-[0.98] transition-transform disabled:opacity-60" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            BUSCAR
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {RAIOS.map((r) => (
          <button key={r} type="button" onClick={() => mudarRaio(r)} className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
            style={raio === r ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
            {r} km
          </button>
        ))}
        {origemLabel && <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#b3ab9c" }}>· {origemLabel}</span>}
      </div>

      {/* inteligência */}
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
        <div className="relative">
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
          <div className="absolute left-2.5 right-2.5 bottom-2 flex flex-wrap gap-1.5 pointer-events-none" style={{ zIndex: 500 }}>
            {[[HOT, `quente · vendas reais (${hot})`], [GOLD, "top 3"], ["#3a3629", "só semáforo"]].map(([cor, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-extrabold" style={{ background: "rgba(10,10,13,.85)", border: "1px solid #22201a", color: "#b3ab9c" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: cor }} /> {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-10 gap-3">
          <LocateFixed className="w-8 h-8 animate-pulse" style={{ color: GOLD }} />
          <p className="text-sm text-center px-4" style={{ color: "#b3ab9c" }}>Cruzando semáforos reais com as vendas dos vendedores do Orbis…</p>
        </div>
      )}

      {nota && !loading && (
        <div className="rounded-[14px] px-4 py-3 text-xs text-center" style={{ background: "#0e0e10", border: "1px solid #22201a", color: "#b3ab9c" }}>{nota}</div>
      )}

      {!loading && user && sinais.map((s, i) => (
        <CardSinal key={s.osm_id} s={s} pos={i + 1} cidade={origem === "gps" ? "" : city} onDuracao={informarDuracao} onJaVendi={jaVendi} />
      ))}

      {!loading && sinais.length === 0 && !center && !nota && (
        <div className="rounded-[18px] p-5 text-center" style={{ background: "#0e0e10", border: "1px solid #22201a" }}>
          <p className="text-sm text-foreground font-bold">Toque em <span style={{ color: GOLD }}>Perto de mim</span> ou busque uma rua</p>
          <p className="text-[11px] mt-1" style={{ color: "#8a8378" }}>18 mil semáforos em 63 cidades, com o nome do cruzamento. Quanto mais gente marca o ponto no fim do DEFCON, mais esperto fica.</p>
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
