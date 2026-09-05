/* ============================================================
   CARGA DO DIA — Etapa 2 da Onda 2 (Rick, 05/09).
   Entra ENTRE o "Modo Desafio" e o DEFCON rodando:
     "Quanto você vai levar hoje?" → escolhe entre os produtos JÁ cadastrados.
   Sem produto cadastrado → oferece cadastrar (é lá que mora "quanto você cobra").
   "hoje eu não controlo estoque" → começa do mesmo jeito, sem carga.
   Reaproveita o DefconLoadoutManager que já existia no Hub — só mudou de lugar.
   ============================================================ */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Info, Package, Loader2 } from "lucide-react";
import { DefconLoadoutManager } from "./DefconLoadoutManager";
import { useDefconLoadout } from "@/hooks/useDefconLoadout";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

export function DefconCargaDoDia({ userId, onComecar, starting }: { userId: string; onComecar: () => void; starting?: boolean }) {
  const { loadout, products, loading } = useDefconLoadout(userId);

  // resumo: itens, custo da carga, quanto entra se vender tudo (pela faixa de 1 un)
  const resumo = useMemo(() => {
    let itens = 0, custo = 0, potencial = 0;
    for (const l of loadout) {
      const p = products.find((x) => x.id === l.product_id) as any;
      const q = Number(l.qty_initial) || 0;
      itens += q;
      custo += q * (Number(p?.cost) || 0);
      potencial += q * (Number(p?.sale_price) || 0);
    }
    return { itens, custo, potencial };
  }, [loadout, products]);

  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
      <p className="orbis-mini">Antes de começar</p>
      <h1 className="font-display text-[22px] font-extrabold leading-tight mt-1">Quanto você vai<br />levar hoje?</h1>
      <p className="text-[12.5px] mt-2 leading-snug" style={{ color: "var(--orbis-fg-3)" }}>O Orbis desconta sozinho a cada venda — e no fim te diz o que sobrou.</p>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--orbis-fg-3)" }} /></div>
        ) : products.length === 0 ? (
          <div className="rounded-[20px] border p-5 text-center" style={{ borderColor: "rgba(245,184,0,.3)", background: "rgba(245,184,0,.05)" }}>
            <Package className="w-6 h-6 mx-auto" style={{ color: "var(--orbis-gold)" }} />
            <p className="text-[14.5px] font-semibold mt-3">Você ainda não cadastrou produto</p>
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>Cadastra o que você vende e quanto cobra — uma vez só. Daí o estoque se cuida sozinho.</p>
            <Link to="/products" className="orbis-cta w-full mt-4 inline-flex">CADASTRAR O QUE VOU LEVAR</Link>
          </div>
        ) : (
          <DefconLoadoutManager userId={userId} />
        )}
      </div>

      {resumo.itens > 0 && (
        <div className="rounded-[16px] border mt-3 p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.24)", background: "rgba(245,184,0,.05)" }}>
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Info className="w-4 h-4" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[13.5px] font-semibold">Levando {resumo.itens} {resumo.itens === 1 ? "item" : "itens"}{resumo.custo > 0 ? ` · custo ${brl0(resumo.custo)}` : ""}</b>
            {resumo.potencial > 0 && <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Se vender tudo, entra {brl0(resumo.potencial)}</small>}
          </span>
        </div>
      )}

      <button onClick={onComecar} disabled={starting}
        className="w-full h-[54px] rounded-[16px] mt-5 font-extrabold text-[15.5px] active:scale-[.98] transition"
        style={{ background: "#E5354A", color: "#FFF", boxShadow: "0 10px 26px -10px rgba(229,53,74,.85)" }}>
        {starting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "COMEÇAR O DIA"}
      </button>
      <button onClick={onComecar} disabled={starting} className="w-full h-10 mt-1 text-[13px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>hoje eu não controlo estoque</button>
    </div>
  );
}
