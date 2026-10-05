/* GUARDAR HOJE — a ação principal da aba. Destino em 3 linhas; o resto em folhas. */
import { useState } from "react";
import { CalendarDays, Check, Flame, PencilLine, RotateCcw } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatCurrency } from "@/shared/lib/utils";
import { BotaoPrimario, BotaoSecundario, COR, Cartao, Folha, LinhaTocavel, Rotulo, haptic } from "./ui";
import { RegistrarValorFolha, type DiaAlvo } from "./RegistrarValorFolha";
import { ProximosDiasFolha } from "./ProximosDiasFolha";
import type { DiaVM } from "./tipos";

export interface Destino { id: string; nome: string; falta: number; dias: number; porDia: number; coberta: boolean }

interface Props {
  carregando: boolean;
  diaFechado: boolean;
  guardadoHoje: number;
  valor: number;
  contas: number;
  objetivos: number;
  diaDeTrabalho: boolean;
  proximoDia: { label: string; valor: number } | null;
  sequencia: number;
  destinos: Destino[];
  dias: DiaVM[];
  metaBase: number;
  vazio: boolean;
  onGuardei: () => Promise<boolean>;
  onRegistrar: (valor: number, dia: DiaAlvo) => Promise<boolean>;
  onReabrirDia: () => void;
}

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const quando = (d: Destino) =>
  d.coberta ? "já coberta" : `${reais(d.falta)} em ${d.dias} ${d.dias === 1 ? "dia" : "dias"}`;

export function GuardarHojeCard(p: Props) {
  const [estado, setEstado] = useState<"normal" | "carregando" | "sucesso">("normal");
  const [folha, setFolha] = useState<null | "destinos" | "proximos">(null);
  const [registrar, setRegistrar] = useState<DiaAlvo | null>(null);

  const guardei = async () => {
    setEstado("carregando");
    const ok = await p.onGuardei();
    if (!ok) { setEstado("normal"); return; }
    haptic("sucesso");
    setEstado("sucesso");
    window.setTimeout(() => setEstado("normal"), 900);
  };

  const visiveis = p.destinos.slice(0, 3);
  const outros = p.destinos.length - visiveis.length;

  return (
    <Cartao style={{ background: "linear-gradient(170deg,#141006 0%,#0b0b0d 70%)", borderColor: "#3a2f0c" }}>
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Guardar hoje</Rotulo>
        {p.sequencia > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-black" style={{ background: "#2a1205", border: "1px solid rgba(255,122,26,.4)", color: "#ff9d4d" }}>
            <Flame className="w-3.5 h-3.5" strokeWidth={2.4} />{p.sequencia} {p.sequencia === 1 ? "dia" : "dias"} seguidos
          </span>
        )}
      </div>

      {p.carregando ? (
        <Skeleton className="h-12 w-48 mt-2" />
      ) : p.diaFechado && estado !== "sucesso" ? (
        <>
          <p className="text-[28px] leading-tight font-black tabular-nums mt-1.5 flex items-center gap-2" style={{ color: COR.verde }}>
            <Check className="w-7 h-7" strokeWidth={3} />
            {p.guardadoHoje > 0 ? `Guardou ${formatCurrency(p.guardadoHoje)}` : "Dia guardado"}
          </p>
          <p className="text-[14px] mt-0.5" style={{ color: COR.sub }}>Dia fechado. Amanhã aparece o novo valor.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <BotaoSecundario onClick={p.onReabrirDia}><RotateCcw className="w-4 h-4" />Desfazer</BotaoSecundario>
            <BotaoSecundario onClick={() => setFolha("proximos")}><CalendarDays className="w-4 h-4" />Próximos dias</BotaoSecundario>
          </div>
        </>
      ) : (
        <>
          <p className="text-[48px] leading-none font-black tracking-tight tabular-nums mt-1.5" style={{ color: COR.ouro }}>{formatCurrency(p.valor)}</p>
          <p className="text-[14px] mt-1.5" style={{ color: COR.sub }}>
            {!p.diaDeTrabalho
              ? <>Hoje é seu descanso.{p.proximoDia ? <> Próximo dia de trabalho ({p.proximoDia.label}): <b style={{ color: COR.texto }}>{formatCurrency(p.proximoDia.valor)}</b>.</> : null}</>
              : p.guardadoHoje > 0 ? <>já guardou {formatCurrency(p.guardadoHoje)} hoje</> : "para manter seu planejamento em dia"}
          </p>
          {!p.vazio && (
            <p className="flex gap-4 text-[13px] mt-1 tabular-nums" style={{ color: COR.mute }}>
              <span>Contas <b style={{ color: COR.texto }}>{formatCurrency(p.contas)}</b></span>
              {p.objetivos > 0.005 && <span>Objetivos <b style={{ color: COR.texto }}>{formatCurrency(p.objetivos)}</b></span>}
            </p>
          )}

          {p.diaDeTrabalho && visiveis.length > 0 && (
            <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
              {visiveis.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2.5 h-9 text-[13.5px]" style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <span className="min-w-0 truncate" style={{ color: "#c9c3b8" }}>
                    {d.nome} <span style={{ color: d.coberta ? COR.verde : COR.mute }}>· {quando(d)}</span>
                  </span>
                  <span className="tabular-nums font-extrabold shrink-0" style={{ color: d.coberta ? COR.mute : COR.texto }}>{formatCurrency(d.coberta ? 0 : d.porDia)}</span>
                </div>
              ))}
              {outros > 0 && (
                <LinhaTocavel onClick={() => setFolha("destinos")} className="h-9 flex items-center">
                  <span className="text-[13px] font-bold" style={{ color: COR.ouro }}>+ {outros} {outros === 1 ? "outra conta" : "outras contas"}</span>
                </LinhaTocavel>
              )}
            </div>
          )}

          {p.vazio ? (
            <p className="text-[14px] mt-3" style={{ color: COR.sub }}>Cadastre uma conta ou um objetivo e a Vant calcula quanto separar por dia.</p>
          ) : p.diaDeTrabalho && (p.valor > 0 || estado === "sucesso") ? (
            <BotaoPrimario className="mt-3" onClick={() => void guardei()} estado={estado}>
              <Check className="w-5 h-5" strokeWidth={3} /> Guardei {formatCurrency(p.valor)}
            </BotaoPrimario>
          ) : null}

          {!p.vazio && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <BotaoSecundario onClick={() => setRegistrar({ label: "hoje", isToday: true })}><PencilLine className="w-4 h-4 shrink-0" />Outro valor</BotaoSecundario>
              <BotaoSecundario onClick={() => setFolha("proximos")}><CalendarDays className="w-4 h-4 shrink-0" />Próximos dias</BotaoSecundario>
            </div>
          )}
        </>
      )}

      <Folha open={folha === "destinos"} onOpenChange={(o) => !o && setFolha(null)} titulo="Para onde vai o de hoje" subtitulo={`${formatCurrency(p.contas)} nas contas · ${formatCurrency(p.objetivos)} nos objetivos`}>
        <div>
          {p.destinos.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 min-h-[56px] border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold" style={{ color: COR.texto }}>{d.nome}</span>
                <span className="block text-[13px]" style={{ color: d.coberta ? COR.verde : COR.sub }}>{quando(d)}</span>
              </span>
              <span className="text-[15px] font-bold tabular-nums shrink-0">{formatCurrency(d.coberta ? 0 : d.porDia)}</span>
            </div>
          ))}
        </div>
      </Folha>

      <ProximosDiasFolha open={folha === "proximos"} onOpenChange={(o) => !o && setFolha(null)} dias={p.dias} metaBase={p.metaBase}
        onEditar={(dia) => { setFolha(null); setRegistrar(dia); }} />

      <RegistrarValorFolha alvo={registrar} onClose={() => setRegistrar(null)} sugerido={registrar?.isToday ? p.valor : 0} onRegistrar={p.onRegistrar} />
    </Cartao>
  );
}
