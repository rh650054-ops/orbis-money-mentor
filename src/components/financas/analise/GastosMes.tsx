/* 1 · GASTOS DO MÊS — o único número grande da aba, o ritmo e a comparação numa folha.
   "Esperado até hoje" = quanto ele costuma ter gastado até este mesmo dia (média dos
   meses fechados), então aluguel no dia 10 não faz o começo do mês parecer barato. */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COR, Folha, LinhaValor, haptic } from "../planejar/ui";
import { nomeMes, reais, ritmo, type Analise } from "./tipos";

function BarraRitmo({ gasto, esperado, cor }: { gasto: number; esperado: number; cor: string }) {
  const escala = Math.max(gasto, esperado) / 0.82 || 1;
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW((gasto / escala) * 100)); return () => cancelAnimationFrame(t); }, [gasto, escala]);
  const marca = (esperado / escala) * 100;
  return (
    <div>
      <div className="relative h-[7px] rounded-full" style={{ background: "#26241f" }}>
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: cor, transition: "width 420ms cubic-bezier(.2,.8,.2,1)" }} />
        <span className="absolute -top-[4px] w-[3px] h-[15px] rounded-full" style={{ left: `calc(${marca}% - 1.5px)`, background: COR.texto, transition: "left 420ms cubic-bezier(.2,.8,.2,1)" }} />
      </div>
      <div className="flex items-center gap-4 mt-2 text-[12px] font-semibold" style={{ color: COR.sub }}>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />Seu gasto</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-[3px] h-3 rounded-full" style={{ background: COR.texto }} />Ritmo esperado</span>
      </div>
    </div>
  );
}

export function GastosMes({ a, podeVoltar, onMes, negocio }: {
  a: Analise; podeVoltar: boolean; onMes: (passo: -1 | 1) => void; negocio: number;
}) {
  const [comparar, setComparar] = useState(false);
  const mes = nomeMes(a.mes);
  const gasto = a.gasto ?? 0;
  const esperado = a.normal_ate_hoje ?? 0;
  const r = ritmo(a);
  const cedo = a.corrente && a.dia <= 3;
  const cor = !r || r.estado === "igual" ? COR.ouro : r.estado === "acima" ? COR.coral : COR.verde;
  const quando = a.corrente ? "até agora" : "neste mês";
  const conclusao = !r ? (gasto > 0 ? "Ainda estamos aprendendo seu normal: a comparação aparece no próximo mês." : `Nenhum gasto em ${mes} ainda.`)
    : cedo ? "O mês mal começou: o ritmo fica mais confiável nos próximos dias."
    : r.estado === "igual" ? `Você está no seu ritmo normal ${quando}.`
    : r.estado === "abaixo" ? `Você está gastando menos que o esperado ${quando}.` : `Você está gastando mais que o esperado ${quando}.`;

  const seta = "w-11 h-11 -my-2 rounded-full flex items-center justify-center transition-[transform,background-color] duration-100 active:scale-[0.94] active:bg-white/[.06] disabled:opacity-25";
  return (
    <section aria-label="Gastos do mês">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>Gastos em {mes}</h2>
        <div className="flex items-center -mr-2">
          <button type="button" aria-label="Mês anterior" disabled={!podeVoltar} onClick={() => { haptic(); onMes(-1); }} className={seta} style={{ color: COR.sub }}><ChevronLeft className="w-5 h-5" strokeWidth={2.4} /></button>
          <button type="button" aria-label="Próximo mês" disabled={a.corrente} onClick={() => { haptic(); onMes(1); }} className={seta} style={{ color: COR.sub }}><ChevronRight className="w-5 h-5" strokeWidth={2.4} /></button>
        </div>
      </div>

      <p className="text-[44px] leading-none font-extrabold tracking-tight tabular-nums mt-2" style={{ color: COR.texto }}>{reais(gasto)}</p>
      {r && r.estado !== "igual" && (
        <p className="text-[15px] font-bold mt-2 tabular-nums" style={{ color: cor }}>
          {r.estado === "abaixo" ? "↓" : "↑"} {reais(Math.abs(r.dif))} {r.estado === "abaixo" ? "abaixo" : "acima"} do seu ritmo
        </p>
      )}
      <p className="text-[13px] mt-1" style={{ color: COR.mute }}>{a.corrente ? `gasto até hoje · dia ${a.dia}` : "total do mês"}</p>

      {r && <div className="mt-4"><BarraRitmo gasto={gasto} esperado={esperado} cor={cor} /></div>}
      <p className="text-[14px] font-semibold mt-3 leading-snug" style={{ color: COR.texto }}>{conclusao}</p>

      {r && (
        <button type="button" onClick={() => setComparar(true)}
          className="group min-h-10 -ml-1.5 px-1.5 mt-1 inline-flex items-center gap-0.5 rounded-[10px] text-[14px] font-extrabold transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.ouro }}>
          Ver comparação <ChevronRight className="w-4 h-4 transition-transform duration-100 group-active:translate-x-0.5" strokeWidth={2.6} />
        </button>
      )}

      <Folha open={comparar} onOpenChange={setComparar} titulo={`Comparação de ${mes}`}
        subtitulo={a.corrente ? `Até o dia ${a.dia}, comparado com a média dos seus últimos ${a.meses_historico} ${a.meses_historico === 1 ? "mês" : "meses"}.` : "Mês fechado, comparado com a sua média."}>
        <div>
          <LinhaValor rotulo={a.corrente ? "Gasto até hoje" : "Gasto no mês"} valor={reais(gasto)} forte />
          <LinhaValor rotulo={a.corrente ? "Esperado até hoje" : "Esperado no mês"} valor={reais(esperado)} />
          {a.projecao != null && <LinhaValor rotulo="Projeção do mês" valor={reais(a.projecao)} cor={COR.ouro} />}
          <LinhaValor rotulo="Média mensal" valor={reais(a.media_mensal ?? 0)} />
          <LinhaValor rotulo={a.corrente ? `Mês passado até o dia ${a.dia}` : "Mês anterior"} valor={reais(a.mes_passado_mesmo_dia ?? 0)} />
        </div>
        <p className="text-[13px] leading-snug" style={{ color: COR.mute }}>
          Projeção = o que já saiu + o que normalmente sai no resto do mês.
          {negocio > 0 ? ` Custos do negócio (${reais(negocio)}) ficam fora desta conta.` : ""}
        </p>
      </Folha>
    </section>
  );
}
