/* The last productions, to fix a count (correction) or undo one. Both ask why, keep the history and
   are refused by the database when the units were already sold. */
import { useState } from "react";
import { toast } from "@/shared/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import type { ProducaoRecente } from "../api/use-producao-query";
import { useCorrigirProducaoMutation, useDesfazerProducaoMutation } from "../api/use-producao-escrita";
import { mensagemDaProducao, novaChave } from "../lib/producao";
import { VANT } from "../lib/visual";
import { Contador } from "./campos";
import { ProducaoMotivo } from "./producao-motivo";
import { BotaoOuro } from "./quiz-casca";
import { ACIMA_DA_CASCA } from "./mercado-casca";

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const STATUS: Record<string, string> = { ativa: "", corrigida: "corrigida", desfeita: "desfeita" };

function Corrigir({ r, onFechar }: { r: ProducaoRecente; onFechar: () => void }) {
  const [qtd, setQtd] = useState(() => r.itens.map((i) => i.unidades));
  const [motivo, setMotivo] = useState("");
  const [chave] = useState(() => novaChave("corr"));
  const corrigir = useCorrigirProducaoMutation();
  const enviar = () => corrigir.mutate({
    registro: r.id, chave, motivo: motivo.trim(),
    itens: r.itens.flatMap((i, k) => ((qtd[k] ?? 0) > 0 ? [{ produto: i.produto, ...(i.sabor ? { sabor: i.sabor } : {}), unidades: qtd[k] ?? 0 }] : [])),
  }, {
    onSuccess: () => { toast({ title: "Produção corrigida", description: "O estoque já está certo." }); onFechar(); },
    onError: (e) => toast({ title: "Não corrigi", description: mensagemDaProducao(e).texto, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent overlayClassName={ACIMA_DA_CASCA} className={`bg-[#0b0b0c] text-[#F4F1EA] border-[#26241f] max-w-sm ${ACIMA_DA_CASCA}`}>
        <DialogHeader><DialogTitle className="text-[19px] font-black">Corrigir produção</DialogTitle></DialogHeader>
        {r.itens.map((i, k) => (
          <Contador key={`${i.produto}:${i.sabor ?? "-"}`} rotulo={`${i.produto_nome}${i.sabor_nome ? ` · ${i.sabor_nome}` : ""}`} valor={qtd[k] ?? 0}
            onChange={(n) => setQtd(qtd.map((x, j) => (j === k ? n : x)))} />
        ))}
        <input value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 300))} aria-label="Motivo da correção" placeholder="Por que corrigir? (ex.: contei errado)"
          className="w-full rounded-[12px] bg-[#151515] border border-[#262626] px-3 h-11 text-[14px] outline-none" />
        <BotaoOuro disabled={motivo.trim().length < 3 || qtd.every((x) => x === 0) || corrigir.isPending} onClick={enviar}>
          {corrigir.isPending ? "CORRIGINDO…" : "SALVAR CORREÇÃO"}
        </BotaoOuro>
      </DialogContent>
    </Dialog>
  );
}

export function ProducaoRecentes({ lista }: { lista: ProducaoRecente[] }) {
  const [corrigindo, setCorrigindo] = useState<ProducaoRecente | null>(null);
  const [desfazendo, setDesfazendo] = useState<ProducaoRecente | null>(null);
  const [chave, setChave] = useState(() => novaChave("desf"));
  const desfazer = useDesfazerProducaoMutation();
  if (lista.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: VANT.ouro }}>ÚLTIMAS PRODUÇÕES</span>
      {lista.map((r) => (
        <div key={r.id} className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1" style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}`, opacity: r.status === "desfeita" ? 0.6 : 1 }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold" style={{ color: VANT.cinza }}>{quando(r.criado_em)}{STATUS[r.status] ? ` · ${STATUS[r.status]}` : ""}</span>
            {r.status !== "desfeita" && (
              <span className="flex gap-3 text-[12.5px] font-black">
                <button type="button" onClick={() => setCorrigindo(r)} style={{ color: VANT.ouro }}>Corrigir</button>
                <button type="button" onClick={() => { setChave(novaChave("desf")); setDesfazendo(r); }} style={{ color: VANT.erro }}>Desfazer</button>
              </span>
            )}
          </div>
          <span className="text-[13.5px] font-extrabold">{r.itens.map((i) => `${i.unidades} ${i.sabor_nome ?? i.produto_nome}`).join(" · ")}</span>
        </div>
      ))}
      {corrigindo && <Corrigir r={corrigindo} onFechar={() => setCorrigindo(null)} />}
      <ProducaoMotivo key={chave} aberto={!!desfazendo} titulo="Desfazer produção" botao="DESFAZER" minimo={3} enviando={desfazer.isPending}
        explicacao="As unidades saem do estoque e os ingredientes voltam, exatamente como foram usados. Fica no histórico."
        onFechar={() => setDesfazendo(null)}
        onEnviar={(motivo) => desfazendo && desfazer.mutate({ registro: desfazendo.id, chave, motivo }, {
          onSuccess: () => { toast({ title: "Produção desfeita", description: "Os ingredientes voltaram para o estoque." }); setDesfazendo(null); },
          onError: (e) => toast({ title: "Não desfiz", description: mensagemDaProducao(e).texto, variant: "destructive" }),
        })} />
    </section>
  );
}
