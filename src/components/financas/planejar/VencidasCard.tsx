/* CONTAS VENCIDAS — resumo; detalhes e plano de quitação só quando pedir. */
import { useState } from "react";
import { AlertTriangle, CalendarClock, Check } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { BotaoPrimario, BotaoSecundario, COR, Cartao, Chip, Folha, Rotulo } from "./ui";
import type { ContaVM } from "./tipos";

type Simular = (falta: number, dias: number) => { porDia: number; quita: string };

const venceuHa = (c: ContaVM) => {
  const n = Math.abs(c.venceEm ?? 0);
  return n === 0 ? "venceu hoje" : `venceu há ${n} ${n === 1 ? "dia" : "dias"}`;
};
const RISCO = { alto: "Risco alto", medio: "Risco médio", baixo: "Risco baixo" } as const;

export function VencidasCard({ contas, onPlano, onPaga, simular }: {
  contas: ContaVM[]; onPlano: (ids: string[], dias: number) => Promise<boolean>; onPaga: (id: string) => Promise<boolean>; simular: Simular;
}) {
  const [lista, setLista] = useState(false);
  const [plano, setPlano] = useState<string[] | null>(null);
  if (contas.length === 0) return null;
  const total = contas.reduce((t, c) => t + c.falta, 0);
  const comPlano = contas.filter((c) => c.plano).length;

  return (
    <Cartao style={{ background: "linear-gradient(170deg,#1c0a08,#0e0e10 70%)", borderColor: "rgba(255,90,69,.42)" }}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" style={{ color: COR.coral }} strokeWidth={2.4} />
        <Rotulo cor={COR.coral}>Contas vencidas</Rotulo>
        <span className="min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center text-[12px] font-black" style={{ background: "rgba(255,107,94,.18)", color: COR.coral }}>{contas.length}</span>
      </div>
      <p className="text-[32px] font-black tabular-nums leading-none mt-2" style={{ color: COR.coral }}>{formatCurrency(total)}</p>
      <p className="text-[14px] font-bold mt-1.5" style={{ color: COR.texto }}>
        {contas.length === 1 ? "1 conta precisa de atenção" : `${contas.length} contas precisam de atenção`}
      </p>
      <p className="text-[13px]" style={{ color: COR.mute }}>
        {comPlano > 0 ? `${comPlano} com plano ativo · entra no guardar de hoje` : "priorize essas contas para evitar mais juros"}
      </p>

      <div className="mt-2">
        {contas.slice(0, 2).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 h-9 border-t text-[14px]" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <span className="font-semibold truncate" style={{ color: "#c9c3b8" }}>{c.nome}</span>
            <span className="font-extrabold tabular-nums" style={{ color: COR.texto }}>{formatCurrency(c.falta)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <BotaoPrimario className="h-11 text-[14px]" onClick={() => setPlano(contas.map((c) => c.id))}>Montar plano</BotaoPrimario>
        <BotaoSecundario className="h-11" onClick={() => setLista(true)}>Ver contas</BotaoSecundario>
      </div>

      <Folha open={lista} onOpenChange={setLista} titulo="Contas vencidas" subtitulo={`${formatCurrency(total)} em aberto`} alta>
        {contas.map((c) => (
          <div key={c.id} className="rounded-[16px] p-4 border" style={{ background: COR.surface, borderColor: "rgba(255,107,94,.22)" }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[17px] font-bold" style={{ color: COR.texto }}>{c.nome}</p>
              <span className="text-[11px] font-bold uppercase tracking-[.06em] rounded-full px-2 py-1 shrink-0"
                style={c.risco === "alto" ? { background: "rgba(255,107,94,.16)", color: COR.coral } : { background: "#24221d", color: COR.sub }}>{RISCO[c.risco]}</span>
            </div>
            <p className="text-[24px] font-bold tabular-nums mt-1" style={{ color: COR.coral }}>{formatCurrency(c.falta)}</p>
            <p className="text-[14px] mt-0.5 flex items-center gap-1.5" style={{ color: COR.sub }}>
              <AlertTriangle className="w-4 h-4" style={{ color: COR.coral }} />{venceuHa(c)} · {formatCurrency(c.guardado)} reservado
            </p>
            {c.plano && (
              <p className="text-[13px] font-semibold mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "rgba(245,184,0,.1)", color: COR.ouro }}>
                <CalendarClock className="w-4 h-4" />Plano ativo · {formatCurrency(c.plano.porDia)}/dia útil · quita ~{c.plano.quita}
              </p>
            )}
            <div className="grid gap-2 mt-3">
              <BotaoSecundario onClick={() => void onPaga(c.id)}><Check className="w-4 h-4" />Marcar como paga</BotaoSecundario>
              <BotaoSecundario tom="ouro" onClick={() => { setLista(false); setPlano([c.id]); }}>{c.plano ? "Mudar plano" : "Montar plano"}</BotaoSecundario>
            </div>
          </div>
        ))}
      </Folha>

      <PlanoFolha ids={plano} contas={contas} simular={simular} onClose={() => setPlano(null)} onUsar={onPlano} />
    </Cartao>
  );
}

function PlanoFolha({ ids, contas, simular, onClose, onUsar }: {
  ids: string[] | null; contas: ContaVM[]; simular: Simular; onClose: () => void; onUsar: (ids: string[], dias: number) => Promise<boolean>;
}) {
  const [dias, setDias] = useState(5);
  const [estado, setEstado] = useState<"normal" | "carregando" | "sucesso">("normal");
  const alvo = contas.filter((c) => ids?.includes(c.id));
  const falta = alvo.reduce((t, c) => t + c.falta, 0);
  const r = simular(falta, dias);
  const usar = async () => {
    if (!ids) return;
    setEstado("carregando");
    const ok = await onUsar(ids, dias);
    if (!ok) { setEstado("normal"); return; }
    setEstado("sucesso");
    window.setTimeout(() => { setEstado("normal"); onClose(); }, 800);
  };
  return (
    <Folha open={ids !== null} onOpenChange={(o) => !o && onClose()} titulo="Em quanto tempo quer quitar?"
      subtitulo={alvo.length === 1 ? `${alvo[0]?.nome} · ${formatCurrency(falta)}` : `${alvo.length} contas · ${formatCurrency(falta)}`}>
      <div className="grid grid-cols-4 gap-2">
        {[3, 5, 10, 15].map((n) => <Chip key={n} ativo={dias === n} onClick={() => setDias(n)}>{n} dias</Chip>)}
      </div>
      <div className="rounded-[16px] p-4" style={{ background: COR.surface2, border: `1px solid ${COR.borda}` }}>
        <p className="text-[30px] font-bold tabular-nums leading-none" style={{ color: COR.ouro }}>{formatCurrency(r.porDia)}<span className="text-[16px] font-semibold" style={{ color: COR.sub }}> / dia útil</span></p>
        <p className="text-[15px] mt-2" style={{ color: COR.sub }}>quitação estimada em <b style={{ color: COR.texto }}>{r.quita}</b></p>
      </div>
      <BotaoPrimario onClick={() => void usar()} estado={estado} sucessoTexto="Plano ativo">Usar este plano</BotaoPrimario>
    </Folha>
  );
}
