/* ============================================================
   META ADAPTATIVA (Rick, 25/10/2026)
   Por padrão a meta do dia é a que ele planejou (um número só). Depois de alguns
   dias vendidos a Vant já conhece o ritmo dele e oferece aqui a meta adaptativa:
   Mínimo · Meta · Turbo pelo ritmo real. Liga e desliga a qualquer hora.
   Conta nova não vê este card (ofereceAdaptativa). Puro: recebe tudo por props.
   ============================================================ */
import { Loader2, Sparkles } from "lucide-react";
import { ofereceAdaptativa, type MetaDoDia } from "@/shared/lib/meta-viavel";
import { brl0, PRESS, type EstadoFoco } from "./foco-tipos";

interface Props {
  m: MetaDoDia | null;
  estado: EstadoFoco;
  salvando: boolean;
  onTrocar: (adaptativa: boolean) => void;
}

export function MetaAdaptativaCard({ m, estado, salvando, onTrocar }: Props) {
  if (!m || !ofereceAdaptativa(m)) return null;
  const ligada = m.modo === "adaptativo";
  const valeAmanha = estado !== "antes";
  const minimo = Math.round((m.metaAdaptativa * 0.8) / 10) * 10;
  const turbo = Math.round((m.metaAdaptativa * 1.2) / 10) * 10;

  if (ligada) {
    return (
      <section className="rounded-[20px] border mt-3 px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }} aria-label="Meta adaptativa">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-gold)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold">Meta adaptativa ligada</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
            pelo seu ritmo{valeAmanha ? " · a troca vale no próximo DEFCON" : ""}
          </p>
        </div>
        <button type="button" disabled={salvando} onClick={() => onTrocar(false)}
          className={`h-8 px-3 rounded-full text-[11.5px] font-extrabold shrink-0 disabled:opacity-60 ${PRESS}`}
          style={{ border: "1px solid rgba(255,255,255,.14)", color: "var(--orbis-fg-2)" }}>
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Usar minha meta"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border mt-3 px-4 py-3.5" style={{ borderColor: "rgba(245,184,0,.30)", background: "linear-gradient(170deg,rgba(245,184,0,.08),var(--orbis-surf) 60%)" }} aria-label="Meta adaptativa">
      <p className="orbis-mini inline-flex items-center gap-1.5" style={{ color: "var(--orbis-gold)" }}><Sparkles className="w-3 h-3" /> Quer melhorar sua performance?</p>
      <p className="text-[15px] font-extrabold leading-snug mt-1.5">Meta adaptativa</p>
      <p className="text-[12.5px] mt-1 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
        A Vant analisou seus <b className="text-foreground">{m.diasVendidos} dias</b> de venda e monta 3 metas pelo seu ritmo. Hoje seria:
      </p>
      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        {([["Mínimo", minimo], ["Meta", m.metaAdaptativa], ["Turbo", turbo]] as const).map(([k, v]) => (
          <div key={k} className="rounded-[12px] px-2 py-1.5 min-w-0" style={{ background: "rgba(0,0,0,.35)", border: "1px solid var(--orbis-line)" }}>
            <p className="text-[9px] font-bold uppercase tracking-[.04em]" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
            <p className="orbis-num text-[13px] font-extrabold mt-0.5 whitespace-nowrap">{brl0(v)}</p>
          </div>
        ))}
      </div>
      <button type="button" disabled={salvando} onClick={() => onTrocar(true)}
        className={`w-full h-11 mt-3 rounded-[14px] text-[13.5px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 ${PRESS}`}
        style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1408" }}>
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ligar meta adaptativa"}
      </button>
      <p className="text-[11px] mt-2 text-center" style={{ color: "var(--orbis-fg-3)" }}>
        {valeAmanha ? "Vale a partir do próximo DEFCON. " : ""}Dá pra voltar pra sua meta quando quiser.
      </p>
    </section>
  );
}
