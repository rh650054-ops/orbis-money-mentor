/* ============================================================
   FOCO · LOTE 4 (03/10)
   • RetomarLugar: alguém te passou no ranking depois que você fechou o dia →
     "RETOMAR MEU LUGAR" volta o DEFCON por mais uma hora (/defcon?mais=1).
   • SinalDeHoje: o Caça-Sinal dentro da Foco, antes de começar. Mostra o SEU
     melhor sinal (caca_sinal_meus, priorizando o dia da semana de hoje); sem
     histórico, o sinal quente mais perto da última posição conhecida.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation, TrendingDown, Radar, ChevronRight, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";
import { getUltimaPosicao } from "@/shared/lib/gps-last";
import { nomeDoSinal } from "@/components/defcon/DefconSinalSheet";

const brl0 = (v: number) => formatCurrency(v).replace(/,00$/, "");
const GOLD = "#F5B800";

export function RetomarLugar({ de, para, falta }: { de: number; para: number; falta: number | null }) {
  const navigate = useNavigate();
  return (
    <div className="mt-3.5 rounded-[18px] px-4 py-3.5" style={{ border: "1px solid rgba(242,70,90,.45)", background: "linear-gradient(170deg,#1c0a0d,#0b0b0b 70%)" }}>
      <p className="inline-flex items-center gap-1.5 text-[10.5px] font-black tracking-[.16em]" style={{ color: "#ff7a8a" }}>
        <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.6} /> TE PASSARAM NO RANKING
      </p>
      <p className="text-[17px] font-extrabold mt-1 leading-snug">
        Você estava em <span style={{ color: GOLD }}>#{de}</span> hoje e caiu pra <span style={{ color: "#ff7a8a" }}>#{para}</span>.
      </p>
      <p className="text-[12.5px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>
        {falta != null && falta > 0 ? <>Faltam <b className="text-foreground">{brl0(falta)}</b> pra passar o #{para - 1} de novo. Uma hora resolve.</> : "Mais uma hora de rua e o lugar volta."}
      </p>
      <button type="button" onClick={() => navigate("/defcon?mais=1")}
        className="w-full h-[52px] rounded-[16px] mt-3 font-extrabold text-[15px] tracking-wide flex items-center justify-center gap-2 active:scale-[.98] transition"
        style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#fff", boxShadow: "0 12px 28px -12px rgba(229,53,74,.9)" }}>
        <Zap className="w-[17px] h-[17px]" fill="#fff" strokeWidth={0} /> RETOMAR MEU LUGAR
      </button>
    </div>
  );
}

type Sinal = { osm_id: number; vias: string | null; lat: number; lng: number; rs_hora: number | null; melhor_hora?: number | null; dist?: number | null; meu: boolean };

export function SinalDeHoje() {
  const navigate = useNavigate();
  const [s, setS] = useState<Sinal | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const rpc = (supabase as unknown as { rpc: (f: string, a?: object) => Promise<{ data: unknown }> }).rpc;
        const { data } = await rpc("caca_sinal_meus");
        const meus = ((data as Array<Record<string, unknown>>) || []).filter((m) => m.lat != null && m.lng != null);
        if (meus.length > 0) {
          const hoje = new Date().getDay();
          const rs = (m: Record<string, unknown>) => Number(m.rs_hora) || 0;
          const best = [...meus].sort((a, b) => (Number(b.melhor_dia_semana === hoje) - Number(a.melhor_dia_semana === hoje)) || rs(b) - rs(a))[0]!;
          if (vivo) setS({ osm_id: Number(best.osm_id), vias: (best.vias as string) ?? null, lat: Number(best.lat), lng: Number(best.lng), rs_hora: rs(best) || null, melhor_hora: best.melhor_hora == null ? null : Number(best.melhor_hora), meu: true });
          return;
        }
        const p = getUltimaPosicao(48 * 3600 * 1000);
        if (!p) return;
        const { data: q } = await rpc("caca_sinais_quentes", { p_lat: p.lat, p_lng: p.lng, p_raio_km: 2 });
        const top = ((q as Array<Record<string, unknown>>) || [])[0];
        if (top && vivo) setS({ osm_id: Number(top.osm_id), vias: (top.vias as string) ?? null, lat: Number(top.lat), lng: Number(top.lng), rs_hora: top.rs_hora == null ? null : Number(top.rs_hora), dist: Number(top.distancia_km), meu: false });
      } catch (e) { avisar.silencioso("Foco: sinal de hoje", e); }
    })();
    return () => { vivo = false; };
  }, []);
  if (!s) return null;
  return (
    <div className="mt-3.5 rounded-[18px] px-4 py-3.5" style={{ border: "1px solid rgba(245,184,0,.32)", background: "linear-gradient(170deg,#171203,#0b0b0b 70%)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10.5px] font-black tracking-[.16em]" style={{ color: GOLD }}>
          <Radar className="w-3.5 h-3.5" strokeWidth={2.6} /> {s.meu ? "SEU MELHOR SINAL" : "SINAL QUENTE PERTO"}
        </p>
        <button type="button" onClick={() => navigate("/spot-finder")} className="inline-flex items-center text-[11.5px] font-extrabold" style={{ color: "var(--orbis-fg-3)" }}>
          Caça-Sinal <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[16px] font-extrabold mt-1.5 leading-snug">{nomeDoSinal(s)}</p>
      <p className="text-[12px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>
        {s.rs_hora ? <><b style={{ color: "var(--orbis-ok)" }}>{brl0(s.rs_hora)}/hora</b>{s.meu ? " pra você aqui" : " de média"}</> : "Ainda sem vendas medidas"}
        {s.melhor_hora != null ? <> · melhor às <b className="text-foreground">{String(s.melhor_hora).padStart(2, "0")}h</b></> : null}
        {s.dist != null ? <> · {s.dist.toFixed(1).replace(".", ",")} km</> : null}
      </p>
      <button type="button" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank")}
        className="w-full h-[44px] rounded-[14px] mt-3 inline-flex items-center justify-center gap-2 text-[13px] font-black"
        style={{ border: "1px solid rgba(245,184,0,.45)", color: GOLD }}>
        <Navigation className="w-4 h-4" strokeWidth={2.4} /> IR PRA LÁ
      </button>
    </div>
  );
}
