/* "Chegou mercadoria" — registro rápido: qual produto, quantas unidades e (se
   quiser) quanto pagou. A leitura da nota pelo QR vem na parte 2. */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { toast } from "@/shared/hooks/use-toast";
import { useChegouMercadoriaMutation } from "../api/use-chegou-mercadoria-mutation";
import { custoPorUnidade } from "../lib/conta";
import type { ProdutoComFaixas } from "../types";
import { CampoDinheiro, Contador, reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";

export function ChegouMercadoria({ aberto, produtos, inicial, userId, onFechar }: {
  aberto: boolean; produtos: ProdutoComFaixas[]; inicial?: string; userId?: string; onFechar: () => void;
}) {
  const [pid, setPid] = useState(inicial ?? produtos[0]?.id ?? "");
  const [unidades, setUnidades] = useState(0);
  const [pago, setPago] = useState(0);
  const chegou = useChegouMercadoriaMutation(userId);
  const prod = produtos.find((p) => p.id === (inicial ?? pid));

  const lancar = () => {
    if (!prod) return;
    chegou.mutate({ productId: prod.id, unidades, totalPago: pago, estoqueAtual: prod.stock_quantity }, {
      onSuccess: () => { toast({ title: `+${unidades} ${prod.name} no estoque` }); setUnidades(0); setPago(0); onFechar(); },
      onError: () => toast({ title: "Não consegui lançar a mercadoria", description: "Tenta de novo.", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm bg-black border-[#26241f] text-[#F4F1EA]">
        <DialogHeader><DialogTitle>📦 Chegou mercadoria</DialogTitle></DialogHeader>
        {!inicial && (
          <div className="flex flex-wrap gap-2">
            {produtos.map((p) => (
              <button key={p.id} type="button" onClick={() => setPid(p.id)} className="rounded-full px-3 py-1.5 text-[13px] font-extrabold"
                style={{ background: p.id === pid ? "#1a1305" : "#121211", border: `1px solid ${p.id === pid ? "#F5B800" : "#26241f"}` }}>
                {p.emoji ?? "📦"} {p.name}
              </button>
            ))}
          </div>
        )}
        {prod && (
          <>
            <p className="text-[13px]" style={{ color: "#b9b3a6" }}>Hoje tem {prod.stock_quantity}. Quantos {prod.name} chegaram?</p>
            <Contador valor={unidades} onChange={setUnidades} />
            <CampoDinheiro rotulo="Quanto pagou por tudo (opcional)" valor={pago} onChange={setPago} />
            {pago > 0 && unidades > 0 && (
              <p className="text-xs font-extrabold" style={{ color: "#F5B800" }}>
                {reais(custoPorUnidade(pago, unidades))} cada · a VANT acerta o custo médio do {prod.name}
              </p>
            )}
            <BotaoOuro onClick={lancar} disabled={!(unidades > 0) || chegou.isPending}>
              {chegou.isPending ? "LANÇANDO…" : `SOMAR ${unidades || ""} NO ESTOQUE`}
            </BotaoOuro>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
