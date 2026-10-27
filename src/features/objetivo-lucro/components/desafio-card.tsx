/* Active profit challenge on Planejar → Objetivos: ring with real profit, one bar per
   day, today's target in units (live from DEFCON) and the Vant's one-line read. */
import { useState } from "react";
import { Flame, Sparkles, Trash2, Trophy } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { useDesafioAtualQuery, useExcluirDesafioMutation } from "../api/use-objetivo-lucro";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { AnelProgresso } from "./anel-progresso";
import { FaixaDias } from "./faixa-dias";
import { COR } from "./ui";

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
  const ia = d.analise.ia;

  return (
    <section className="rounded-[24px] p-4 relative overflow-hidden" aria-label="Desafio de lucro"
      style={{ background: `radial-gradient(120% 70% at 100% 0%, ${bateu ? "rgba(61,214,140,.2)" : "rgba(245,184,0,.18)"}, #0e0e10 60%)`, border: `1px solid ${cor}55`, boxShadow: `0 24px 60px -36px ${cor}` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-section inline-flex items-center gap-1.5" style={{ color: cor }}>
          {bateu ? <Trophy className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />} Desafio de lucro
        </p>
        <span className="orbis-num text-[11px] font-black px-2 py-0.5 rounded-full" style={{ color: COR.texto, background: "rgba(255,255,255,.08)" }}>
          {acabou ? "encerrado" : bateu ? "bateu!" : `dia ${d.dia_atual} de ${d.dias_periodo}`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <AnelProgresso pct={pct} cor={cor}>
          <span className="orbis-num text-[22px] font-black leading-none" style={{ color: cor }}>{Math.round(pct)}%</span>
          <span className="text-[10px] font-bold mt-0.5" style={{ color: COR.mute }}>do lucro</span>
        </AnelProgresso>
        <div className="min-w-0 flex-1">
          <p className="orbis-num text-[26px] font-black leading-none tracking-tight" style={{ color: COR.texto }}>{formatCurrency(d.lucro)}</p>
          <p className="text-[12.5px] mt-1" style={{ color: COR.sub }}>de <b className="orbis-num" style={{ color: COR.texto }}>{brl0(d.alvo)}</b> em {d.dias_periodo} dias</p>
          <p className="orbis-num text-[11.5px] mt-1.5" style={{ color: COR.mute }}>{d.unidades} {un} · {d.dias_trabalhados}/{d.dias_trabalho} dias de trabalho</p>
        </div>
      </div>

      <FaixaDias d={d} />

      {bateu ? (
        <p className="text-[14px] font-extrabold mt-3" style={{ color: COR.verde }}>Bateu! {formatCurrency(d.lucro)} de lucro de verdade. 🏆</p>
      ) : acabou ? (
        <p className="text-[13px] mt-3" style={{ color: COR.sub }}>O prazo acabou. Faltaram {formatCurrency(Math.max(0, d.alvo - d.lucro))} — dá pra criar outro desafio.</p>
      ) : (
        <div className="mt-3 rounded-[16px] px-3.5 py-3 flex items-center gap-3" style={{ background: "rgba(0,0,0,.4)", border: `1px solid ${hojeOk ? "rgba(61,214,140,.4)" : "rgba(245,184,0,.3)"}` }}>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[.06em]" style={{ color: COR.mute }}>Hoje</p>
            <p className="text-[16px] font-black mt-0.5 leading-tight" style={{ color: hojeOk ? COR.verde : COR.texto }}>
              {hojeOk ? "Meta de hoje batida ✓" : `Vender ${d.hoje.unid_meta ?? "—"} ${un}`}
            </p>
            <p className="orbis-num text-[12px] mt-0.5" style={{ color: COR.sub }}>já foram {d.hoje.unid} · {formatCurrency(d.hoje.lucro)} de lucro</p>
          </div>
          <span className="orbis-num text-[22px] font-black shrink-0" style={{ color: hojeOk ? COR.verde : COR.ouro }}>{d.hoje.unid}<span className="text-[13px]" style={{ color: COR.mute }}>/{d.hoje.unid_meta ?? "—"}</span></span>
        </div>
      )}

      {ia?.titulo && !bateu && !acabou && (
        <p className="mt-3 text-[12.5px] leading-snug flex gap-1.5" style={{ color: COR.sub }}>
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: COR.ouro }} /> <span><b style={{ color: COR.texto }}>{ia.titulo}</b>{ia.alerta ? ` — ${ia.alerta}` : ""}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10.5px]" style={{ color: COR.mute }}>lucro = vendas − {formatCurrency(d.custo_unid)} por {nomeUnidade(d.analise.produto_nome, 1)}</p>
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
