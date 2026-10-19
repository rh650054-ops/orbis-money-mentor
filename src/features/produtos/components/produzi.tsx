/* "Produzi" (Rick, 19/10): fez as garrafinhas → diz quantas. Entram no estoque do
   produto e os insumos baixam (pela receita, ou pela parte da compra: 50 de 100 =
   metade de cada item). Depois cada venda no Foco tira do estoque do produto. */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { toast } from "@/shared/hooks/use-toast";
import { useProduzirMutation } from "../api/use-producao-mutations";
import { Contador, reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";

export interface Pendente { previstas: number; produzidas: number; custo: number }

export function Produzi({ produto, pendente, onFechar }: {
  produto: { id: string; name: string } | null; pendente?: Pendente; onFechar: () => void;
}) {
  const falta = pendente ? Math.max(pendente.previstas - pendente.produzidas, 0) : 0;
  const [n, setN] = useState(falta);
  const produzir = useProduzirMutation();
  const nome = produto?.name.toLowerCase() ?? "";
  return (
    <Dialog open={!!produto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="bg-[#0b0b0c] text-[#F4F1EA] border-[#26241f] max-w-sm">
        <DialogHeader><DialogTitle className="text-[22px] font-black">Produzi {nome}s</DialogTitle></DialogHeader>
        {pendente && (
          <p className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
            Da última compra faltam <b style={{ color: "#F5B800" }}>{falta} de {pendente.previstas}</b>
            {pendente.custo > 0 ? ` · ${reais(pendente.custo)} cada` : ""}.
          </p>
        )}
        <Contador rotulo={`Quantas ${nome}s você fez?`} valor={n} onChange={setN} unidade="un" grande />
        <p className="text-[12px] font-bold" style={{ color: "#7b766e" }}>Entram no estoque e os insumos baixam na mesma medida.</p>
        <BotaoOuro disabled={!produto || n < 1 || produzir.isPending}
          onClick={() => produto && produzir.mutate({ produto: produto.id, unidades: n }, {
            onSuccess: (r) => { toast({ title: `+${n} ${produto.name} no estoque`, description: `Agora tem ${r.estoque}.` }); onFechar(); },
            onError: () => toast({ title: "Não consegui dar baixa", description: "Tenta de novo daqui a pouco.", variant: "destructive" }),
          })}>
          {produzir.isPending ? "GUARDANDO…" : "PRODUZI"}
        </BotaoOuro>
      </DialogContent>
    </Dialog>
  );
}
