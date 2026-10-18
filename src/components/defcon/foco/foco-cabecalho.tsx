/* Cabeçalho do Foco: seção · data, clima e streak como chips, saudação e a linha de estado.
   Streak = dias com Foco aberto no mês (rank.dias) — desacoplado de bater a meta (Duolingo). */
import { Zap } from "lucide-react";
import { ClimaChip } from "@/components/clima/ClimaChip";
import type { EstadoFoco } from "./foco-tipos";

interface Props {
  estado: EstadoFoco;
  dataLabel: string;
  nome: string;
  diasNoMes: number;
  horaInicio: number | null;
  blocoN: number;
  blocosTot: number;
  minRestantes: number | null;
  naRua: string;
  vendas: number;
}

export function FocoCabecalho({ estado, dataLabel, nome, diasNoMes, horaInicio, blocoN, blocosTot, minRestantes, naRua, vendas }: Props) {
  const primeiro = nome ? nome.split(" ")[0] : "";
  return (
    <header>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="orbis-mini">Foco · {dataLabel}</p>
        <div className="flex items-center gap-1.5">
          {estado !== "encerrado" && <ClimaChip />}
          {diasNoMes > 0 && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11.5px] font-bold" style={{ border: "1px solid rgba(245,184,0,.35)", background: "rgba(245,184,0,.1)", color: "var(--orbis-gold)" }}>
              <Zap className="w-3 h-3" fill="currentColor" strokeWidth={0} />{diasNoMes} {diasNoMes === 1 ? "dia" : "dias"}
            </span>
          )}
        </div>
      </div>
      <h1 className="font-display text-[24px] font-extrabold tracking-tight mt-2 leading-tight">
        {estado === "rodando" ? "Tá rodando." : estado === "encerrado" ? "Dia fechado." : `Bora pro corre${primeiro ? `, ${primeiro}` : ""}.`}
      </h1>
      <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
        {estado === "rodando" && <>Bloco <b className="text-foreground">{blocoN}{blocosTot ? ` de ${blocosTot}` : ""}</b>{minRestantes != null ? <> · <b className="text-foreground">{minRestantes} min</b> pra fechar essa hora</> : null}</>}
        {estado === "encerrado" && <>{naRua} na rua · {vendas} {vendas === 1 ? "venda" : "vendas"}{diasNoMes ? <> · <b className="text-foreground">{diasNoMes} {diasNoMes === 1 ? "dia" : "dias"}</b> vendendo este mês</> : null}</>}
        {estado === "antes" && <>{horaInicio != null ? <>Você começa às <b className="text-foreground">{String(horaInicio).padStart(2, "0")}h</b></> : "Seu dia começa quando você apertar"}{diasNoMes ? <> · {diasNoMes} {diasNoMes === 1 ? "dia" : "dias"} vendendo este mês</> : null}</>}
      </p>
    </header>
  );
}
