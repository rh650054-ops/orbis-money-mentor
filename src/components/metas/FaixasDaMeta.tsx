/* Barra com as três faixas do dia: Mínimo · Meta · Turbo (Rick, 11/10/2026).
   A barra vai até o Turbo; cada marca acende quando o vendido passa dela. */
import { faixaAtingida, type MetaDoDia } from "@/shared/lib/meta-viavel";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

export function FaixasDaMeta({ m, vendido, compacta = false }: { m: Pick<MetaDoDia, "minimo" | "meta" | "turbo">; vendido: number; compacta?: boolean }) {
  const fim = Math.max(1, m.turbo);
  const pct = Math.max(0, Math.min(100, (vendido / fim) * 100));
  const faixa = faixaAtingida(vendido, m);
  const marcas: { k: "minimo" | "meta" | "turbo"; rotulo: string; v: number }[] = [
    { k: "minimo", rotulo: "Mínimo", v: m.minimo },
    { k: "meta", rotulo: "Meta", v: m.meta },
    { k: "turbo", rotulo: "Turbo", v: m.turbo },
  ];
  const ordem = { nenhuma: 0, minimo: 1, meta: 2, turbo: 3 } as const;
  const cor = faixa === "turbo" ? "#F5B800" : faixa !== "nenhuma" ? "#3DD68C" : "#F2465A";
  return (
    <div>
      <div className="relative h-[9px] rounded-full overflow-visible" style={{ background: "rgba(255,255,255,.08)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${cor}cc,${cor})` }} />
        {marcas.map((x) => {
          const left = Math.min(100, (x.v / fim) * 100);
          const acesa = ordem[faixa] >= ordem[x.k];
          return (
            <span key={x.k} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{ left: `${left}%`, width: 15, height: 15, background: acesa ? cor : "#141416", border: `2.5px solid ${acesa ? "#0b0b0b" : "rgba(255,255,255,.28)"}`, boxShadow: acesa ? `0 0 0 3px ${cor}33` : "none" }} />
          );
        })}
      </div>
      <div className={`grid grid-cols-3 ${compacta ? "mt-2" : "mt-2.5"}`}>
        {marcas.map((x, i) => {
          const acesa = ordem[faixa] >= ordem[x.k];
          return (
            <div key={x.k} className={i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"}>
              <p className="text-[9.5px] font-extrabold uppercase tracking-[.1em]" style={{ color: acesa ? cor : "var(--orbis-fg-3)" }}>{x.rotulo}{acesa ? " ✓" : ""}</p>
              <p className={`orbis-num font-bold ${compacta ? "text-[12px]" : "text-[13px]"}`} style={{ color: acesa ? "var(--orbis-fg-1, #F4F1EA)" : "var(--orbis-fg-2)" }}>{brl0(x.v)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
