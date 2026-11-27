import { BarChart3, Landmark, MapPin, Sparkles, Timer, Trophy, type LucideIcon } from "lucide-react";
import { DESTAQUES, type IconeDestaque } from "../lib/planos";

const GOLD = "#F5B800";
const ICONES: Record<IconeDestaque, LucideIcon> = { foco: Timer, relatorio: BarChart3, banco: Landmark, mentor: Sparkles, sinal: MapPin, ranking: Trophy };

/** The top of the paywall: the promise first, then what the app does, before any price. */
export function PaywallTopo({ troca }: { troca: boolean }) {
  return (
    <header className="text-center">
      <p className="text-[12px] font-black tracking-[.46em] pl-[.46em]" style={{ color: GOLD }}>VANT</p>
      <h1 className="mt-3 font-black leading-[1.05] tracking-[-.025em] text-[clamp(26px,7.6vw,32px)]">
        {troca ? "Troque de plano quando quiser." : <>Venda mais.<br /><span style={{ color: GOLD }}>Saiba quanto lucrou.</span></>}
      </h1>
      <p className="mt-2.5 text-[13.5px] leading-snug mx-auto max-w-[300px]" style={{ color: "#a9a397" }}>
        O app de quem vende na rua: meta, vendas e lucro do dia na palma da mão.
      </p>
    </header>
  );
}

export function PaywallBeneficios() {
  return (
    <ul aria-label="O que a VANT faz" className="mt-6 grid gap-[14px]">
      {DESTAQUES.map((d) => {
        const Icone = ICONES[d.icone];
        return (
          <li key={d.titulo} className="flex items-start gap-3.5 text-left">
            <span aria-hidden className="shrink-0 w-10 h-10 rounded-[12px] flex items-center justify-center"
              style={{ background: "linear-gradient(160deg,rgba(245,184,0,.16),rgba(245,184,0,.04))", border: "1px solid rgba(245,184,0,.22)", color: GOLD }}>
              <Icone className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="flex items-center gap-2 text-[14.5px] font-extrabold leading-tight">
                {d.titulo}
                {d.so_pro && <span className="rounded-[6px] px-1.5 py-[2px] text-[9.5px] font-black tracking-[.08em]" style={{ background: "rgba(245,184,0,.14)", color: GOLD }}>PRO</span>}
              </span>
              <span className="block text-[12.5px] leading-snug mt-0.5" style={{ color: "#8f897c" }}>{d.texto}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
