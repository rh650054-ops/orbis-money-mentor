/* ============================================================
   HORA A HORA — a linha do tempo do dia, com CONVERSÃO por hora.

   Voltou em 10/09 (Rick): era a leitura mais inteligente da tela antiga e
   sumiu na reforma. A conversão por hora é o que separa "hora ruim porque
   abordei mal" de "hora ruim porque não passava ninguém" — e o conselho é
   diferente em cada caso.

   Vendas: hora real de cada venda (defcon_sales.created_at, Brasília).
   Abordagens: o bloco do DEFCON que começou naquela hora (challenge_blocks).
   Mostra TODAS as horas entre a primeira e a última venda, inclusive as
   vazias — são justamente as que ensinam algo.
   ============================================================ */
import { useMemo } from "react";
import { formatCurrency } from "@/shared/lib/utils";

interface Venda { created_at: string; amount?: number }
interface Bloco { started_at?: string | null; created_at?: string | null; approaches_count?: number | null; sales_count?: number | null }

const horaBR = (iso: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t - 3 * 3600000).getUTCHours();
};

export function montarHoraAHora(vendas: Venda[], blocos: Bloco[]) {
  const porHora: Record<number, { total: number; vendas: number; abordagens: number }> = {};
  const slot = (h: number) => (porHora[h] ??= { total: 0, vendas: 0, abordagens: 0 });
  for (const v of vendas) {
    const h = horaBR(v.created_at);
    if (h == null) continue;
    const s = slot(h);
    s.total += Number(v.amount) || 0;
    s.vendas += 1;
  }
  for (const b of blocos) {
    const ini = b.started_at || b.created_at;
    if (!ini) continue;
    const h = horaBR(ini);
    if (h == null) continue;
    slot(h).abordagens += Number(b.approaches_count) || 0;
  }
  const horas = Object.keys(porHora).map(Number).filter((h) => porHora[h]!.vendas > 0).sort((a, b) => a - b);
  if (horas.length === 0) return null;
  const linhas = [];
  for (let h = horas[0]!; h <= horas[horas.length - 1]!; h++) {
    const s = porHora[h];
    const ab = s?.abordagens ?? 0;
    linhas.push({
      hora: h,
      label: `${h}h`,
      total: s?.total ?? 0,
      vendas: s?.vendas ?? 0,
      abordagens: ab,
      conversao: ab > 0 ? Math.min(100, ((s?.vendas ?? 0) / ab) * 100) : null,
    });
  }
  const comVenda = linhas.filter((l) => l.total > 0);
  const melhor = comVenda.reduce((a, b) => (b.total > a.total ? b : a));
  const pior = comVenda.reduce((a, b) => (b.total < a.total ? b : a));
  return { linhas, melhor, pior, max: melhor.total || 1 };
}

export function HoraAHora({ vendas, blocos }: { vendas: Venda[]; blocos: Bloco[] }) {
  const dados = useMemo(() => montarHoraAHora(vendas, blocos), [vendas, blocos]);
  if (!dados) return null;
  const { linhas, melhor, pior, max } = dados;

  return (
    <div>
      <p className="orbis-section mb-2.5 px-1">Hora a hora</p>
      <section className="orbis-card-in rounded-2xl border border-border/60 bg-card" style={{ padding: "14px 14px 12px" }}>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] px-3 py-2.5" style={{ border: "1px solid rgba(245,184,0,.35)", background: "rgba(245,184,0,.07)" }}>
            <p className="orbis-section" style={{ color: "var(--orbis-gold)" }}>Hora mais forte</p>
            <p className="orbis-num text-[22px] font-extrabold leading-none mt-1" style={{ color: "var(--orbis-gold)" }}>{melhor.label}</p>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>{formatCurrency(melhor.total)} · {melhor.vendas} {melhor.vendas === 1 ? "venda" : "vendas"}</p>
          </div>
          <div className="rounded-[12px] px-3 py-2.5" style={{ border: "1px solid var(--orbis-line)", background: "var(--orbis-surf)" }}>
            <p className="orbis-section">Hora mais fraca</p>
            <p className="orbis-num text-[22px] font-extrabold leading-none mt-1">{pior.label}</p>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>{formatCurrency(pior.total)} · {pior.vendas} {pior.vendas === 1 ? "venda" : "vendas"}</p>
          </div>
        </div>

        <div className="grid items-center gap-2.5 mt-3" style={{ gridTemplateColumns: "36px minmax(0,1fr) 92px 44px" }}>
          <span /><span />
          <span className="orbis-section text-right" style={{ fontSize: 10.5 }}>vendido</span>
          <span className="orbis-section text-right" style={{ fontSize: 10.5 }}>conv.</span>
        </div>
        <div className="flex flex-col">
          {linhas.map((l) => {
            const best = l.hora === melhor.hora;
            const vazia = l.total <= 0;
            return (
              <div key={l.hora} className="grid items-center gap-2.5 h-10" style={{ gridTemplateColumns: "36px minmax(0,1fr) 92px 44px" }}>
                <span className="orbis-num text-[13px] font-bold" style={{ color: best ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }}>{l.label}</span>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
                  <div className="orbis-fill h-full rounded-full" style={{ width: `${Math.round((l.total / max) * 100)}%`, background: best ? "var(--orbis-gold)" : "#8a6a00" }} />
                </div>
                <span className="text-right">
                  <span className="orbis-num block text-[13.5px] font-extrabold" style={{ color: vazia ? "var(--orbis-fg-3)" : best ? "var(--orbis-gold)" : undefined }}>
                    {vazia ? "—" : formatCurrency(l.total)}
                  </span>
                  <span className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>
                    {vazia ? "sem venda" : `${l.vendas} ${l.vendas === 1 ? "venda" : "vendas"}`}
                  </span>
                </span>
                <span className="orbis-num text-right text-[13px] font-extrabold" style={{ color: l.conversao == null ? "var(--orbis-fg-3)" : l.conversao >= 50 ? "var(--orbis-ok)" : "var(--orbis-fg-2)" }}>
                  {l.conversao == null ? "—" : `${Math.round(l.conversao)}%`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[12.5px] leading-relaxed mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>
          Conversão é quantas abordagens viraram venda naquela hora. Hora que fatura pouco e converte bem não tem problema de abordagem — tem pouca gente passando.
        </p>
      </section>
    </div>
  );
}
