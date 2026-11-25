/* Aba Estoque, A (25/11): two numbers only — units ready to sell and recipes needing attention. */
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { reais } from "./campos";

export function EstoqueResumo({ prontos, valor, atencao }: { prontos: number; valor: number; atencao: number }) {
  const Card = ({ Icone, cor, valor: v, rotulo, sub }: { Icone: typeof CheckCircle2; cor: string; valor: string; rotulo: string; sub?: string }) => (
    <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1 min-w-0" style={{ background: "#121212", border: "1px solid #2a2722" }}>
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-tight" style={{ color: "#d8d2c4" }}>
        <Icone className="w-4 h-4 shrink-0" style={{ color: cor }} /> {rotulo}
      </span>
      <span className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: cor }}>{v}</span>
      {sub && <span className="text-[11px] font-semibold" style={{ color: "#8f897e" }}>{sub}</span>}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Card Icone={CheckCircle2} cor="#3DD68C" valor={`${prontos.toLocaleString("pt-BR")} un`} rotulo="Prontos para vender" sub={valor > 0 ? `${reais(valor)} em mercadoria` : undefined} />
      <Card Icone={TriangleAlert} cor={atencao > 0 ? "#FF9A3D" : "#3DD68C"} valor={String(atencao)} rotulo="Receitas com atenção" sub={atencao > 0 ? "veja abaixo o que falta" : "tudo certo para produzir"} />
    </div>
  );
}
