/* ============================================================
   A CONTA DO PERÍODO — Vendeu → Gastou → Sobrou pra você.

   Por que existe (Rick, 10/09): na reforma de 01/09 o bloco "Faturamento
   bruto → custos → Lucro líquido" foi recolhido num acordeão e o vendedor
   deixou de ver gastos e lucro sem tocar em nada. O Higor reclamou no grupo:
   "tô com mais dificuldade do que era antes em conseguir mexer e entender".
   Este bloco devolve os três numa conta de padaria, sempre visível, na mesma
   língua do fechamento do DEFCON e da tela Finanças ("Sobrou pra você").
   ============================================================ */
import { formatCurrency } from "@/shared/lib/utils";

interface Props {
  titulo: string;                 // "A conta do dia" · "A conta da semana" · "A conta do período"
  vendeu: number;
  mercadoria: number;
  transporte: number;
  comida: number;
  outros: number;
  sobrou: number;
}

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(n));

export function ContaDoPeriodo({ titulo, vendeu, mercadoria, transporte, comida, outros, sobrou }: Props) {
  const gastou = mercadoria + transporte + comida + outros;
  const margem = vendeu > 0 ? Math.max(0, Math.min(100, (sobrou / vendeu) * 100)) : 0;
  const deCadaDez = vendeu > 0 ? (sobrou / vendeu) * 10 : 0;
  const partes = [
    mercadoria > 0 ? `mercadoria ${brl0(mercadoria)}` : null,
    transporte > 0 ? `transporte ${brl0(transporte)}` : null,
    comida > 0 ? `comida ${brl0(comida)}` : null,
    outros > 0 ? `outros ${brl0(outros)}` : null,
  ].filter(Boolean) as string[];

  return (
    <section
      className="orbis-card-in rounded-2xl border"
      style={{ borderColor: "rgba(245,184,0,.34)", background: "linear-gradient(180deg,#171203, hsl(var(--card)))", padding: "14px 16px 16px" }}
    >
      <p className="orbis-label">{titulo}</p>

      <div className="flex items-baseline justify-between pt-3 pb-[11px] text-[15px] font-semibold">
        <span>Vendeu</span>
        <span className="orbis-num text-[17px] font-extrabold">{formatCurrency(vendeu)}</span>
      </div>

      <div className="flex items-start justify-between gap-3 py-[11px] text-[15px] font-semibold" style={{ borderTop: "1px solid var(--orbis-line)" }}>
        <span className="min-w-0">
          <span className="block">Gastou</span>
          <span className="block text-[12px] font-semibold mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
            {partes.length > 0 ? partes.join(" · ") : "nenhum custo lançado"}
          </span>
        </span>
        <span className="orbis-num text-[17px] font-extrabold whitespace-nowrap" style={{ color: gastou > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>
          {gastou > 0 ? `− ${formatCurrency(gastou)}` : formatCurrency(0)}
        </span>
      </div>

      <div className="flex items-baseline justify-between pt-3 pb-1 text-[15px] font-extrabold" style={{ borderTop: "1px solid rgba(245,184,0,.34)" }}>
        <span>Sobrou pra você</span>
        <span className="orbis-num text-[26px] font-extrabold" style={{ color: sobrou >= 0 ? "var(--orbis-gold)" : "var(--orbis-custo)" }}>
          {formatCurrency(sobrou)}
        </span>
      </div>

      {vendeu > 0 && (
        <>
          <div className="flex h-2 w-full rounded-full overflow-hidden mt-2.5 bg-white/10">
            <div className="orbis-fill h-full" style={{ width: `${margem}%`, background: "var(--orbis-gold)" }} />
            <div className="h-full flex-1" style={{ background: gastou > 0 ? "var(--orbis-custo)" : "transparent" }} />
          </div>
          <p className="text-[12.5px] mt-2" style={{ color: "var(--orbis-fg-2)" }}>
            {gastou > 0
              ? <>De cada R$ 10 vendidos, <b style={{ color: "var(--orbis-gold)" }}>R$ {deCadaDez.toFixed(2).replace(".", ",")} ficam com você</b> · margem {Math.round(margem)}%</>
              : <>Sem custo lançado, tudo que vendeu conta como lucro. No DEFCON é o botão <b className="text-foreground">Custo</b>.</>}
          </p>
        </>
      )}
    </section>
  );
}
