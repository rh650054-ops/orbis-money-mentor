/* "R$ X do que você vendeu hoje não caiu no banco. Foi em dinheiro?"
   Com o Pix travado pelo banco, o que não caiu vira calote até cair — mas boa
   parte costuma ser dinheiro que ele não digitou no fechamento (Rick, 10/10).
   Um toque passa o valor do calote pro dinheiro do dia (dia_marcar_dinheiro). */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

const brl2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function NaoCaiuNoBanco({ dia, naoCaiu, onMudou }: { dia: string; naoCaiu: number; onMudou: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(brl2(naoCaiu));
  const [salvando, setSalvando] = useState(false);
  const [dispensou, setDispensou] = useState(false);
  if (!(naoCaiu > 0.004) || dispensou) return null;

  const valor = () => { const d = texto.replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; };
  const salvar = async () => {
    const v = Math.min(valor(), naoCaiu);
    if (!(v > 0)) return;
    setSalvando(true);
    const { error } = await (supabase as any).rpc("dia_marcar_dinheiro", { p_dia: dia, p_valor: v });
    setSalvando(false);
    if (error) { avisar.usuario("Não consegui salvar. Tenta de novo.", error, "NaoCaiuNoBanco: marcar dinheiro"); return; }
    toast({ title: `${formatCurrency(v)} entraram como dinheiro`, description: "Saiu do calote e voltou pro ranking." });
    setAberto(false);
    onMudou();
  };

  return (
    <section className="rounded-[22px] border p-4 flex flex-col gap-3" style={{ background: "var(--orbis-surf)", borderColor: "rgba(255,154,77,.4)" }}>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold">
          <b style={{ color: "#ff9a4d" }}>{formatCurrency(naoCaiu)}</b> do que você vendeu hoje não caiu no banco
        </p>
        <p className="text-[12.5px]" style={{ color: "var(--orbis-fg-3)" }}>
          Até cair, conta como calote: sai do lucro e do ranking. Recebeu parte em dinheiro?
        </p>
      </div>
      {aberto ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 flex items-center h-11 rounded-xl px-3 border" style={{ borderColor: "rgba(245,184,0,.5)" }}>
            <span className="text-sm mr-1.5" style={{ color: "var(--orbis-fg-3)" }}>R$</span>
            <input type="text" inputMode="numeric" value={texto} autoFocus aria-label="Quanto foi em dinheiro"
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setTexto(d ? brl2(parseInt(d, 10) / 100) : ""); }}
              className="w-full bg-transparent outline-none font-extrabold tabular-nums" />
          </span>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="h-11 px-4 rounded-xl font-extrabold disabled:opacity-50"
            style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>{salvando ? "…" : "Salvar"}</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setAberto(true)} className="flex-1 h-11 rounded-xl font-extrabold" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>
            Foi em dinheiro
          </button>
          <button type="button" onClick={() => setDispensou(true)} className="flex-1 h-11 rounded-xl font-bold border" style={{ borderColor: "var(--orbis-line)" }}>
            Ficou devendo
          </button>
        </div>
      )}
    </section>
  );
}
