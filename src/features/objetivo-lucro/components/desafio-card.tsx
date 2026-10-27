/* Active profit challenge on Planejar → Objetivos: how much profit so far,
   which day it is and how many units to sell TODAY (updates with DEFCON). */
import { useState } from "react";
import { Flame, Trash2, Trophy } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { useDesafioAtualQuery, useExcluirDesafioMutation } from "../api/use-objetivo-lucro";
import { nomeUnidade } from "../lib/plano";
import { Barra, COR } from "./ui";
import { brl0 } from "../lib/formato";

export function DesafioCard() {
  const { data: d } = useDesafioAtualQuery();
  const excluir = useExcluirDesafioMutation();
  const [confirmar, setConfirmar] = useState(false);
  if (!d) return null;

  const un = nomeUnidade(d.analise.produto_nome);
  const pct = d.alvo > 0 ? (d.lucro / d.alvo) * 100 : 0;
  const bateu = d.status === "concluido";
  const acabou = d.status === "encerrado";
  const hojeOk = d.hoje.unid_meta !== null && d.hoje.unid >= d.hoje.unid_meta;
  const cor = bateu ? COR.verde : COR.ouro;

  return (
    <section className="rounded-[20px] p-4" aria-label="Desafio de lucro"
      style={{ background: bateu ? "linear-gradient(170deg,rgba(61,214,140,.12),#0e0e10 60%)" : "linear-gradient(170deg,rgba(245,184,0,.10),#0e0e10 60%)", border: `1px solid ${bateu ? "rgba(61,214,140,.4)" : "rgba(245,184,0,.35)"}` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-section inline-flex items-center gap-1.5" style={{ color: cor }}>
          {bateu ? <Trophy className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />} Desafio de lucro
        </p>
        <span className="orbis-num text-[12px] font-bold" style={{ color: COR.mute }}>
          {acabou ? "encerrado" : `dia ${d.dia_atual} de ${d.dias_periodo}`}
        </span>
      </div>
      <p className="text-[15px] font-extrabold mt-1.5" style={{ color: COR.texto }}>{brl0(d.alvo)} de lucro em {d.dias_periodo} dias</p>

      <p className="orbis-num text-[28px] font-black leading-none mt-3 tracking-tight" style={{ color: cor }}>
        {formatCurrency(d.lucro)} <span className="text-[13px] font-bold" style={{ color: COR.sub }}>de {brl0(d.alvo)}</span>
      </p>
      <div className="mt-2.5"><Barra pct={pct} cor={cor} /></div>
      <p className="orbis-num text-[12px] mt-1.5" style={{ color: COR.mute }}>
        {Math.round(pct)}% · {d.unidades} {un} vendidas · {d.dias_trabalhados} de {d.dias_trabalho} dias de trabalho
      </p>

      {bateu ? (
        <p className="text-[13.5px] font-bold mt-3" style={{ color: COR.verde }}>Bateu! {formatCurrency(d.lucro)} de lucro de verdade.</p>
      ) : acabou ? (
        <p className="text-[13px] mt-3" style={{ color: COR.sub }}>O prazo acabou. Faltaram {formatCurrency(Math.max(0, d.alvo - d.lucro))} — dá pra criar outro desafio.</p>
      ) : (
        <div className="mt-3 rounded-[14px] px-3.5 py-3" style={{ background: "rgba(0,0,0,.35)", border: `1px solid ${hojeOk ? "rgba(61,214,140,.35)" : COR.linha}` }}>
          <p className="text-[11px] font-bold uppercase tracking-[.05em]" style={{ color: COR.mute }}>Hoje</p>
          <p className="text-[15px] font-extrabold mt-0.5" style={{ color: COR.texto }}>
            {hojeOk ? "Meta de hoje batida ✓" : `Venda ${d.hoje.unid_meta ?? "—"} ${un}`}
            <span className="text-[12.5px] font-semibold" style={{ color: COR.sub }}> · {formatCurrency(d.hoje.precisa)} de lucro</span>
          </p>
          <p className="orbis-num text-[12px] mt-0.5" style={{ color: COR.sub }}>já vendeu {d.hoje.unid} · {formatCurrency(d.hoje.lucro)} de lucro</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px]" style={{ color: COR.mute }}>Lucro = vendas − {formatCurrency(d.custo_unid)} por {nomeUnidade(d.analise.produto_nome, 1)}</p>
        <button type="button" disabled={excluir.isPending}
          onClick={() => (confirmar ? excluir.mutate(d.id) : setConfirmar(true))}
          className="h-8 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 shrink-0"
          style={{ color: confirmar ? COR.vermelho : COR.mute, border: `1px solid ${confirmar ? "rgba(229,115,127,.4)" : COR.linha}` }}>
          <Trash2 className="w-3.5 h-3.5" /> {confirmar ? "Confirmar" : "Excluir"}
        </button>
      </div>
    </section>
  );
}
