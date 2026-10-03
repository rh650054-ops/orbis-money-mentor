/* ============================================================
   GUARDA UM PEDAÇO? — caixinha pela meta no fim do DEFCON (Lote 6,
   mockup "Open Finance na Vant · v3", tela 2C).
   (alvo − guardado) ÷ dias até a data = R$/dia. A Vant arredonda pra cima
   (de 10 em 10) e diz o que rende: "fica 1 dia na frente". Dia forte de Pix
   sugere mais. GUARDAR soma na caixinha e no "guardado hoje" das Finanças.
   ============================================================ */
import { useEffect, useState } from "react";
import { Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

export interface Sugestao { goal_id: string; nome: string; icon: string | null; alvo: number; tem: number; falta: number; data: string; dias: number; por_dia: number; sequencia: number; guardado_hoje: number }

type Rpc = (f: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (f, a) => (supabase as unknown as { rpc: Rpc }).rpc(f, a);
const brl0 = (v: number) => formatCurrency(v).replace(/,00$/, "");
const GOLD = "#F5B800";

/** Valores sugeridos: o do dia arredondado pra cima (10 em 10), um passo acima e R$ 100.
 *  Dia forte de Pix (≥ 10× o diário) sugere o dobro primeiro. Nunca passa do que falta. */
export function valoresSugeridos(porDia: number, falta: number, pixHoje: number): number[] {
  const arred = (v: number) => Math.max(10, Math.ceil(v / 10) * 10);
  const base = arred(pixHoje >= porDia * 10 && porDia > 0 ? porDia * 2 : porDia);
  const lista = [base, arred(base * 1.5), 100].map((v) => Math.min(v, Math.ceil(falta)));
  return Array.from(new Set(lista)).filter((v) => v > 0).sort((a, b) => a - b);
}

/** "fica N dias na frente" do ritmo que a meta pede. */
export function diasNaFrente(valor: number, porDia: number): number {
  return porDia > 0 ? Math.max(0, Math.floor(valor / porDia) - 1) : 0;
}

export function CaixinhaMeta({ pixHoje, onFechar }: { pixHoje: number; onFechar?: () => void }) {
  const [s, setS] = useState<Sugestao | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [outro, setOutro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    rpc("caixinha_sugestao").then(({ data, error }) => {
      if (error) { avisar.silencioso("caixinha_sugestao", error); return; }
      const r = data as Sugestao | null;
      if (!vivo || !r) return;
      const n = { ...r, alvo: Number(r.alvo) || 0, tem: Number(r.tem) || 0, falta: Number(r.falta) || 0, por_dia: Number(r.por_dia) || 0, guardado_hoje: Number(r.guardado_hoje) || 0 };
      setS(n);
      setValor(valoresSugeridos(n.por_dia, n.falta, pixHoje)[0] ?? null);
    });
    return () => { vivo = false; };
  }, [pixHoje]);

  if (!s) return null;
  const opcoes = valoresSugeridos(s.por_dia, s.falta, pixHoje);
  const v = outro ? Number(outro.replace(",", ".")) || 0 : valor ?? 0;
  const frente = diasNaFrente(v, s.por_dia);
  const dataAlvo = new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const tem = s.tem + (feito ?? 0);
  const pct = s.alvo > 0 ? Math.min(100, Math.round((tem / s.alvo) * 100)) : 0;

  const guardar = async () => {
    if (v <= 0) return;
    setSalvando(true);
    const { error } = await rpc("caixinha_guardar", { p_goal: s.goal_id, p_valor: v });
    setSalvando(false);
    if (error) { toast({ title: "Não deu pra guardar", description: error.message, variant: "destructive" }); return; }
    try { navigator.vibrate?.([40, 30, 80]); } catch { /* sem vibração */ }
    setFeito((f) => (f ?? 0) + v);
    toast({ title: `Guardou ${brl0(v)} na ${s.nome}` });
  };

  return (
    <div className="rounded-[18px] p-4" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black tracking-[.15em]" style={{ color: GOLD }}>GUARDA UM PEDAÇO?</p>
        <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black truncate" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.4)", color: GOLD }}>
          {s.icon ?? "🎯"} {s.nome} · {brl0(s.alvo)} até {dataAlvo}
        </span>
      </div>
      {feito ? (
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "#b9b3a6" }}>
          <b style={{ color: "var(--orbis-ok, #3DD68C)" }}>Guardado: {brl0(feito)}.</b> {tem >= s.alvo ? "Caixinha completa!" : `Faltam ${brl0(Math.max(0, s.alvo - tem))} pra ${s.nome}.`}
        </p>
      ) : (
        <>
          <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "#b9b3a6" }}>
            {pixHoje > 0 ? <><b className="text-foreground">Caiu {brl0(pixHoje)} no Pix hoje.</b> </> : null}
            Pra chegar na meta você precisa de <b className="text-foreground">{brl0(s.por_dia)}/dia</b>.
            {v > 0 ? <> Separa <b style={{ color: GOLD }}>{brl0(v)}</b>{frente > 0 ? <> e fica {frente} {frente === 1 ? "dia" : "dias"} na frente</> : null}.</> : null}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {opcoes.map((o) => (
              <button key={o} type="button" onClick={() => { setValor(o); setOutro(""); }}
                className="h-9 px-3.5 rounded-full text-[12.5px] font-black"
                style={!outro && valor === o ? { background: GOLD, color: "#1a1305" } : { background: "#1b1a17", border: "1px solid #2a2823", color: "#b9b3a6" }}>
                {brl0(o)}
              </button>
            ))}
            <input inputMode="decimal" placeholder="outro" value={outro} onChange={(e) => setOutro(e.target.value.replace(/[^\d,.]/g, ""))}
              className="h-9 w-[84px] px-3 rounded-full text-[12.5px] font-black bg-transparent outline-none text-foreground"
              style={{ border: `1px solid ${outro ? GOLD : "#2a2823"}` }} />
          </div>
          <button type="button" onClick={guardar} disabled={salvando || v <= 0}
            className="w-full h-12 rounded-[14px] mt-3 inline-flex items-center justify-center gap-2 text-[14px] font-black disabled:opacity-60"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} GUARDAR {v > 0 ? brl0(v) : ""}
          </button>
        </>
      )}
      <div className="flex items-center justify-between mt-3 text-[10.5px] font-bold" style={{ color: "#7b766e" }}>
        <span className="inline-flex items-center gap-1">{s.sequencia > 0 ? <><Flame className="w-3 h-3" style={{ color: "#ff9d4d" }} /> {s.sequencia} {s.sequencia === 1 ? "dia" : "dias"} seguidos</> : "comece a sequência hoje"}</span>
        <span>{brl0(tem)} de {brl0(s.alvo)} · {pct}%</span>
      </div>
      <div className="h-[7px] rounded-full mt-1.5 overflow-hidden" style={{ background: "#1c1c1b" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#B88E00,#FFC800)" }} />
      </div>
      {!feito && onFechar && <button type="button" onClick={onFechar} className="w-full mt-2 text-[11.5px] font-extrabold underline underline-offset-2" style={{ color: "#7b766e" }}>agora não</button>}
    </div>
  );
}
