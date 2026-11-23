/* What the production will take from stock, as the database computed it (producao_simular), and what
   is missing. Shown before the seller confirms. */
import type { Simulacao } from "../api/use-producao-query";
import { VANT } from "../lib/visual";

const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function ProducaoPrevia({ sim, carregando, erro }: { sim: Simulacao | undefined; carregando: boolean; erro: string | null }) {
  if (erro) return <p className="text-[13px] font-bold rounded-[14px] px-3 py-2.5" style={{ color: VANT.erro, background: "rgba(255,107,107,.08)" }}>{erro}</p>;
  if (carregando && !sim) return <p className="text-[12.5px] font-bold" style={{ color: VANT.cinza }}>Calculando os ingredientes…</p>;
  if (!sim || sim.consumo.length === 0) return null;
  const falta = new Map(sim.faltas.map((f) => [f.ingrediente, f]));
  return (
    <section className="rounded-[16px] px-3.5 py-3 flex flex-col gap-1.5" style={{ background: VANT.cartao, border: `1px solid ${sim.faltas.length ? VANT.erro : VANT.borda}` }}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: VANT.ouro }}>VAI SAIR DO ESTOQUE</span>
      {sim.consumo.map((c) => {
        const f = falta.get(c.ingrediente);
        return (
          <div key={c.ingrediente} className="flex items-baseline justify-between gap-2 text-[13px] font-bold">
            <span className="truncate">{c.nome}</span>
            <span className="tabular-nums shrink-0" style={{ color: f ? VANT.erro : VANT.texto }}>
              {n(c.real)} {c.unidade}{f ? ` · tem ${n(f.tem)}` : ""}
            </span>
          </div>
        );
      })}
      {sim.faltas.length > 0 && (
        <p className="text-[12px] font-bold" style={{ color: VANT.erro }}>Falta ingrediente. Registre a compra no Mercado ou diminua as quantidades.</p>
      )}
      {sim.avisos.map((a) => <p key={a} className="text-[12px] font-bold" style={{ color: VANT.cinza }}>{a}</p>)}
    </section>
  );
}
