/* ============================================================
   CAIU NO BOLSO — o bloco do Financeiro, agora também no fim do Foco
   (Rick, 17/10/2026 21:29). Vendido em cima, verde = o que caiu, vermelho =
   o que não caiu. Quem tem banco vê o que o banco mostrou, não o que digitou.
   ============================================================ */
import { AnimatedCurrency } from "@/shared/motion";
import { formatCurrency } from "@/shared/lib/utils";

const OK = "var(--orbis-ok,#3DD68C)";
const CALOTE = "var(--orbis-calote,#FF5C5C)";

export function CaiuNoBolso({ vendido, caiu, rotuloFaltou = "Faltou cair", compacto = false }: {
  vendido: number; caiu: number;
  /** "Faltou cair" (passado) ou "Falta cair" (hoje — o banco ainda pode mostrar) */
  rotuloFaltou?: string;
  /** Fim do Foco: número menor, sem animação */
  compacto?: boolean;
}) {
  const faltou = Math.max(0, Math.round((vendido - caiu) * 100) / 100);
  const base = Math.max(vendido, caiu);
  const pct = base > 0 ? Math.min(100, Math.max(0, (caiu / base) * 100)) : 0;
  return (
    <section className={`orbis-card-in rounded-2xl border border-border/60 bg-card ${compacto ? "p-3.5 space-y-2" : "p-4 space-y-3"}`}>
      <p className="orbis-label" style={{ color: OK }}>Caiu no bolso</p>
      <p className={`font-display font-extrabold leading-none tabular-nums ${compacto ? "text-[24px]" : "text-[30px]"}`} style={{ color: OK }}>
        {compacto ? formatCurrency(caiu) : <AnimatedCurrency value={caiu} />}
      </p>
      <p className="text-[12.5px] text-muted-foreground -mt-1">
        {pct.toFixed(0)}% de tudo que você vendeu já entrou
      </p>
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/10">
        <div className="orbis-fill h-full" style={{ width: `${pct}%`, background: OK }} />
        <div className="h-full flex-1" style={{ background: faltou > 0 ? CALOTE : "transparent" }} />
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Vendido {formatCurrency(vendido)}</span>
        <span className="font-bold" style={{ color: faltou > 0 ? CALOTE : "hsl(var(--muted-foreground))" }}>
          {faltou > 0 ? `${rotuloFaltou} ${formatCurrency(faltou)}` : "caiu tudo 🎉"}
        </span>
      </div>
    </section>
  );
}
