/* Finanças · Resumo (redesign 28/11/2026): shared pieces of the six cards.
   Same language as Produtos and Estoque: black background, graphite cards with a quiet border,
   gold = action/priority, green = positive result, red = expense/negative. */
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrency } from "@/shared/lib/utils";

export const COR = {
  ouro: "#F5B800",
  verde: "#3DD68C",
  vermelho: "#FF6B5E",
  azul: "#5AB0FF",
  texto: "#F4F1EA",
  sub: "#b9b3a6",
  mute: "#8f897f",
  cartao: "#121211",
  borda: "#26241f",
  linha: "rgba(255,255,255,.06)",
} as const;

/** Whole reais when the cents are zero, like the rest of Finanças. */
export const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
/** Signed amount with a real minus sign: "− R$ 10", "+ R$ 10". */
export const comSinal = (v: number) => `${v < 0 ? "−" : "+"} ${reais(Math.abs(v))}`;
export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const nomeMes = () => {
  const m = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  return m.charAt(0).toUpperCase() + m.slice(1);
};

type Tom = "normal" | "ouro" | "vermelho";
const FUNDO: Record<Tom, { background: string; borderColor: string }> = {
  normal: { background: COR.cartao, borderColor: COR.borda },
  ouro: { background: "linear-gradient(170deg,#1a1405 0%,#121211 75%)", borderColor: "rgba(245,184,0,.45)" },
  vermelho: { background: "linear-gradient(170deg,#1c0a08 0%,#121211 75%)", borderColor: "rgba(255,107,94,.45)" },
};

export function Cartao({ children, tom = "normal", rotulo }: { children: ReactNode; tom?: Tom; rotulo: string }) {
  return (
    <section aria-label={rotulo} className="orbis-card-in rounded-[20px] border p-[18px] flex flex-col" style={FUNDO[tom]}>
      {children}
    </section>
  );
}

export function Titulo({ children, cor = COR.sub, icone }: { children: ReactNode; cor?: string; icone?: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] font-black uppercase tracking-[.14em]" style={{ color: cor }}>
      {icone}{children}
    </p>
  );
}

/** Section title outside the cards ("Meu negócio · Novembro"). */
export function Secao({ titulo, lado }: { titulo: string; lado?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-2 -mb-1">
      <h2 className="text-[17px] font-black" style={{ color: COR.texto }}>{titulo}</h2>
      {lado && <span className="text-[12.5px] font-bold" style={{ color: COR.sub }}>{lado}</span>}
    </div>
  );
}

export function Divisor() {
  return <div className="my-4 h-px" style={{ background: COR.linha }} />;
}

/** Gold shortcut with an arrow at the right edge, the whole row is the touch target. */
export function Atalho({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-3 -mb-1 min-h-11 w-full flex items-center justify-between gap-2 text-[13.5px] font-extrabold rounded-lg active:opacity-70"
      style={{ color: COR.ouro }}>
      <span>{children}</span>
      <ChevronRight className="w-4 h-4" strokeWidth={2.6} />
    </button>
  );
}

export function Valor({ rotulo, valor, cor = COR.texto, icone }: { rotulo: string; valor: string; cor?: string; icone?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}>{icone}{rotulo}</p>
      <p className="text-[19px] font-black tabular-nums leading-tight mt-1 whitespace-nowrap truncate" style={{ color: cor }}>{valor}</p>
    </div>
  );
}

/** Discreet ring for the margin. */
export function AnelMargem({ pct, cor }: { pct: number; cor: string }) {
  const r = 22, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative w-[54px] h-[54px] shrink-0" role="img" aria-label={`Margem de ${Math.round(p)}%`}>
      <svg viewBox="0 0 54 54" className="w-full h-full -rotate-90">
        <circle cx="27" cy="27" r={r} fill="none" stroke="#24221d" strokeWidth="5" />
        <circle cx="27" cy="27" r={r} fill="none" stroke={cor} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset 400ms ease-out" }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[12.5px] font-black tabular-nums" style={{ color: COR.texto }}>{Math.round(p)}%</span>
        <span className="text-[7.5px] font-bold mt-0.5" style={{ color: COR.mute }}>margem</span>
      </span>
    </div>
  );
}

export function Esqueleto({ rotulo, linhas = 2 }: { rotulo: string; linhas?: number }) {
  return (
    <section aria-label={rotulo} aria-busy="true" className="rounded-[20px] border p-[18px]" style={FUNDO.normal}>
      <div className="h-3 w-32 rounded animate-pulse" style={{ background: "#1f1e1a" }} />
      <div className="h-8 w-44 rounded-lg mt-3 animate-pulse" style={{ background: "#1f1e1a" }} />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-3 rounded mt-3 animate-pulse" style={{ background: "#1a1916", width: `${70 - i * 20}%` }} />
      ))}
    </section>
  );
}
