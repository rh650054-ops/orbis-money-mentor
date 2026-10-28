/* Active mission on Planejar → Objetivos: HUD card with the ring of real profit,
   one bar per day, today's target in units (live from DEFCON) and the Vant's read. */
import { useState } from "react";
import { Crosshair, Sparkles, Trash2, Trophy } from "lucide-react";
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
  const ativo = !bateu && !acabou;
  const hojeOk = d.hoje.unid_meta !== null && d.hoje.unid >= d.hoje.unid_meta;
  const folga = !d.hoje.trabalha;  // 28/10: the plan says today is a day off
  const ritmo = d.hoje.ritmo === "adiantado" ? { txt: `adiantado ${brl0(Math.abs(d.hoje.atraso ?? 0))} no plano`, cor: COR.verde }
    : d.hoje.ritmo === "atrasado" ? { txt: `${brl0(Math.abs(d.hoje.atraso ?? 0))} atrás do plano — a meta dos próximos dias subiu`, cor: COR.vermelho }
    : d.hoje.ritmo === "no_plano" ? { txt: "no ritmo do plano", cor: COR.sub } : null;
  const cor = bateu ? COR.verde : COR.ouro;
  const faltam = Math.max(0, d.dias_periodo - d.dia_atual + 1);
  const ia = d.analise.ia;

  return (
    <section className={`vant-hud ${bateu ? "vant-verde" : ""} rounded-[24px] px-4 pt-4 pb-3.5 overflow-hidden`} aria-label="Desafio de lucro"
      style={{ border: `1px solid ${cor}66`, boxShadow: `0 24px 70px -36px ${cor}` }}>
      <span className="vant-canto" />
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-section inline-flex items-center gap-1.5" style={{ color: cor }}>
          {bateu ? <Trophy className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />} Missão {bateu ? "cumprida" : acabou ? "encerrada" : "ativa"}
        </p>
        {ativo && (
          <span className="orbis-num text-[10.5px] font-black uppercase tracking-[.1em] px-2 py-1 rounded-full inline-flex items-center gap-1.5" style={{ color: COR.texto, border: `1px solid ${COR.linha}`, background: "rgba(255,255,255,.05)" }}>
            <span className="vant-blink w-1.5 h-1.5 rounded-full" style={{ background: cor }} /> dia {d.dia_atual}/{d.dias_periodo}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <AnelProgresso pct={pct} cor={cor} tamanho={104}>
          <span className="vant-missao-num text-[30px] leading-none" style={{ color: cor }}>{Math.round(pct)}%</span>
        </AnelProgresso>
        <div className="min-w-0 flex-1">
          <p className="vant-missao-num text-[36px] leading-none tracking-tight" style={{ color: COR.texto }}>{formatCurrency(d.lucro)}</p>
          <p className="text-[12.5px] mt-1" style={{ color: COR.sub }}>de <b className="orbis-num" style={{ color: cor }}>{brl0(d.alvo)}</b> de lucro em {d.dias_periodo} dias</p>
          <p className="orbis-num text-[11.5px] mt-1.5" style={{ color: COR.mute }}>{d.unidades} {un} · {d.dias_trabalhados}/{d.dias_trabalho} dias de trabalho{ativo ? ` · faltam ${faltam} dias` : ""}</p>
        </div>
      </div>

      <FaixaDias d={d} />

      {bateu ? (
        <p className="text-[14px] font-black mt-3" style={{ color: COR.verde }}>Missão cumprida: {formatCurrency(d.lucro)} de lucro de verdade. 🏆</p>
      ) : acabou ? (
        <p className="text-[13px] mt-3" style={{ color: COR.sub }}>O prazo acabou. Faltaram {formatCurrency(Math.max(0, d.alvo - d.lucro))} — bora pra próxima missão.</p>
      ) : (
        <div className="mt-3 rounded-[16px] px-3.5 py-3 flex items-center gap-3" style={{ background: "rgba(0,0,0,.45)", border: `1px solid ${hojeOk ? "rgba(61,214,140,.45)" : folga ? COR.linha : "rgba(245,184,0,.35)"}` }}>
          <div className="min-w-0 flex-1">
            <p className="orbis-section" style={{ color: hojeOk ? COR.verde : folga ? COR.mute : COR.ouro }}>{folga ? "Hoje é folga na missão" : "Alvo de hoje"}</p>
            <p className="text-[16px] font-black mt-0.5 leading-tight" style={{ color: hojeOk ? COR.verde : COR.texto }}>
              {hojeOk ? "Batido ✓" : folga ? `Se for pra rua: ${d.hoje.unid_meta ?? "—"} ${un} adiantam` : `Vender ${d.hoje.unid_meta ?? "—"} ${un}`}
            </p>
            <p className="orbis-num text-[11.5px] mt-0.5" style={{ color: COR.sub }}>{formatCurrency(d.hoje.lucro)} de lucro já{folga ? "" : ` · precisa ${formatCurrency(d.hoje.precisa)}`}</p>
          </div>
          <span className="vant-missao-num text-[36px] leading-none shrink-0" style={{ color: hojeOk ? COR.verde : folga ? COR.sub : COR.ouro }}>{d.hoje.unid}<span className="text-[18px]" style={{ color: COR.mute }}>/{d.hoje.unid_meta ?? "—"}</span></span>
        </div>
      )}
      {ativo && ritmo && <p className="orbis-num text-[11.5px] mt-2 px-0.5" style={{ color: ritmo.cor }}>• {ritmo.txt}</p>}

      {ia?.titulo && ativo && (
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
          <Trash2 className="w-3.5 h-3.5" /> {confirmar ? "Confirmar" : "Abortar"}
        </button>
      </div>
    </section>
  );
}
