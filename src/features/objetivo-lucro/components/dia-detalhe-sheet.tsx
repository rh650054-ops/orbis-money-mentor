/* 05/11 (Rick): "preciso poder clicar em cada gráfico ali; quando clico ele mostra como foi
   aquele dia". One day of the mission: plan vs real, how he got paid, what fell in, calote,
   cost, profit, the Foco hours and the sales hour by hour. Opens from the bar strip and from
   the day-by-day cards, wherever the mission card appears. */
import { Check, Clock, Moon } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { Skeleton } from "@/shared/ui/skeleton";
import { useDiaMissaoQuery } from "../api/use-dia-missao";
import type { Desafio, DiaMissao } from "../types";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { COR } from "./ui";

const brl2 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "—");
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function tituloDoDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return `${DIAS[dt.getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function Num({ rotulo, valor, cor, sub }: { rotulo: string; valor: string; cor?: string; sub?: string }) {
  return (
    <div className="rounded-[14px] px-3 py-2.5" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
      <p className="orbis-section" style={{ color: COR.mute }}>{rotulo}</p>
      <p className="vant-missao-num text-[22px] leading-none mt-1" style={{ color: cor ?? COR.texto }}>{valor}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: COR.sub }}>{sub}</p>}
    </div>
  );
}

function Linha({ k, v, cor }: { k: string; v: string; cor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]" style={{ borderBottom: `1px solid ${COR.linha}` }}>
      <span style={{ color: COR.sub }}>{k}</span>
      <b className="orbis-num" style={{ color: cor ?? COR.texto }}>{v}</b>
    </div>
  );
}

function PorHora({ horas, melhor }: { horas: DiaMissao["horas"]; melhor: number | null }) {
  const max = Math.max(1, ...horas.map((h) => h.valor));
  const ini = Math.min(...horas.map((h) => h.h)); const fim = Math.max(...horas.map((h) => h.h));
  const faixa = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
  const porH = new Map(horas.map((h) => [h.h, h]));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-14" aria-label="Vendas por hora">
        {faixa.map((h) => {
          const x = porH.get(h);
          const v = x?.valor ?? 0;
          return <span key={h} className="flex-1 rounded-[3px]" title={`${h}h · ${brl0(v)}`}
            style={{ height: Math.max(4, (v / max) * 56), background: h === melhor ? COR.verde : v > 0 ? COR.ouro : "rgba(255,255,255,.08)" }} />;
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-bold" style={{ color: COR.mute }}>
        <span>{ini}h</span>{melhor !== null && <span style={{ color: COR.verde }}>melhor hora: {melhor}h</span>}<span>{fim + 1}h</span>
      </div>
    </div>
  );
}

function Corpo({ x, d }: { x: DiaMissao; d: Desafio }) {
  const un = nomeUnidade(d.analise.produto_nome);
  const semVenda = x.unid <= 0 && x.vendido <= 0;
  const corLucro = x.lucro > 0 ? COR.verde : x.lucro < 0 ? COR.vermelho : COR.sub;
  if (x.futuro) {
    return (
      <div className="rounded-[16px] px-4 py-4 text-center" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
        {x.trabalha ? (
          <>
            <p className="orbis-section" style={{ color: COR.ouro }}>Plano pra esse dia</p>
            <p className="vant-missao-num text-[30px] leading-none mt-2" style={{ color: COR.ouro }}>{x.plano_unid} <span className="text-[13px] font-bold" style={{ color: COR.sub }}>{un}</span></p>
            <p className="text-[12.5px] mt-1.5" style={{ color: COR.sub }}>pra sobrar <b style={{ color: COR.verde }}>{brl0(x.plano_lucro)}</b> de lucro</p>
          </>
        ) : (
          <p className="text-[14px] font-bold inline-flex items-center gap-2" style={{ color: COR.mute }}><Moon className="w-4 h-4" /> folga no plano</p>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Num rotulo={x.trabalha ? "Vendeu" : "Folga · vendeu"} valor={`${x.unid} ${un}`} cor={x.bateu ? COR.verde : COR.ouro}
          sub={x.trabalha && x.plano_unid > 0 ? (x.bateu ? `plano era ${x.plano_unid} · bateu` : `plano era ${x.plano_unid} · faltaram ${Math.max(0, x.plano_unid - x.unid)}`) : `${x.vendas} vendas`} />
        <Num rotulo={x.hoje ? "Lucro (estimativa)" : "Lucro de verdade"} valor={brl0(x.lucro)} cor={corLucro}
          sub={x.trabalha && x.plano_lucro > 0 ? `plano era ${brl0(x.plano_lucro)}` : undefined} />
      </div>
      {semVenda ? (
        <p className="text-[13px] text-center py-3" style={{ color: COR.mute }}>Nenhuma venda lançada nesse dia.</p>
      ) : (
        <>
          <div className="rounded-[16px] px-4 py-1" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
            <Linha k="Vendido no Foco" v={brl2(x.vendido)} />
            <Linha k="Dinheiro" v={brl2(x.dinheiro)} />
            <Linha k="Pix" v={brl2(x.pix)} />
            {x.cartao > 0 && <Linha k="Cartão" v={brl2(x.cartao)} />}
            {x.gorjeta > 0 && <Linha k="Gorjeta" v={brl2(x.gorjeta)} cor={COR.verde} />}
            {x.fiado > 0 && <Linha k="Fiado (pra depois)" v={brl2(x.fiado)} cor={COR.vermelho} />}
            <Linha k={x.fonte === "banco" ? "Caiu de verdade (banco)" : x.fonte === "app" ? "Caiu de verdade" : "Deve cair (hoje)"} v={brl2(x.recebido)} cor={COR.verde} />
            {x.calote > 0 && <Linha k="Calote" v={`− ${brl2(x.calote)}`} cor={COR.vermelho} />}
            <Linha k={`Custo · ${x.unid} × ${brl2(x.custo_unid)}`} v={`− ${brl2(x.custo)}`} cor={COR.vermelho} />
            <div className="flex items-center justify-between py-2 text-[14px]"><b style={{ color: COR.texto }}>Sobrou</b><b className="orbis-num" style={{ color: corLucro }}>{brl2(x.lucro)}</b></div>
          </div>
          {x.inicio && (
            <p className="text-[12.5px] inline-flex items-center gap-2" style={{ color: COR.sub }}>
              <Clock className="w-4 h-4" style={{ color: COR.ouro }} /> Foco das {hora(x.inicio)} às {hora(x.fim)}{x.minutos ? ` · ${Math.floor(x.minutos / 60)}h${String(x.minutos % 60).padStart(2, "0")} na rua` : ""}
            </p>
          )}
          {x.horas.length > 0 && <PorHora horas={x.horas} melhor={x.melhor_hora} />}
        </>
      )}
    </>
  );
}

export function DiaDetalheSheet({ d, dia, onFechar }: { d: Desafio; dia: string | null; onFechar: () => void }) {
  const { data: x, isLoading } = useDiaMissaoQuery(d.id, dia);
  return (
    <Gaveta open={!!dia} onOpenChange={(o) => !o && onFechar()} titulo="Como foi o dia" style={{ background: COR.fundo, borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1 space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div>
          <p className="orbis-section" style={{ color: COR.ouro }}>Como foi o dia</p>
          <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground mt-1 flex items-center gap-2">
            {dia ? tituloDoDia(dia) : ""}
            {x?.bateu && <Check className="w-5 h-5" style={{ color: COR.verde }} strokeWidth={3} />}
          </h3>
        </div>
        {isLoading || !x ? <div className="space-y-2"><Skeleton className="h-16 rounded-[14px]" /><Skeleton className="h-40 rounded-[16px]" /></div> : <Corpo x={x} d={d} />}
      </div>
    </Gaveta>
  );
}
