/* Cabeçalho do Foco: seção · data, clima compacto, saudação e a linha de estado.
   21/10 (Mohamed): o chip de streak ("14 dias") saiu daqui — a sequência fica só no Dashboard. */
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

export function FocoCabecalho({ estado, dataLabel, nome, horaInicio, blocoN, blocosTot, minRestantes, naRua, vendas }: Props) {
  const primeiro = nome ? nome.split(" ")[0] : "";
  return (
    <header>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="orbis-mini">Foco · {dataLabel}</p>
        {estado !== "encerrado" && <ClimaChip />}
      </div>
      <h1 className="font-display text-[24px] font-extrabold tracking-tight mt-2 leading-tight">
        {estado === "rodando" ? "Tá rodando." : estado === "encerrado" ? "Dia fechado." : `Bora pro corre${primeiro ? `, ${primeiro}` : ""}.`}
      </h1>
      <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
        {estado === "rodando" && <>Bloco <b className="text-foreground">{blocoN}{blocosTot ? ` de ${blocosTot}` : ""}</b>{minRestantes != null ? <> · <b className="text-foreground">{minRestantes} min</b> pra fechar essa hora</> : null}</>}
        {estado === "encerrado" && <>{naRua} na rua · {vendas} {vendas === 1 ? "venda" : "vendas"}</>}
        {estado === "antes" && <>{horaInicio != null ? <>Você começa às <b className="text-foreground">{String(horaInicio).padStart(2, "0")}h</b></> : "Seu dia começa quando você apertar"}</>}
      </p>
    </header>
  );
}
