/* "Sua atividade": 3 numbers that matter, never a row of unexplained zeros. */
import { useNavigate } from "react-router-dom";
import { SkeletonStat } from "@/shared/components/skeletons";
import type { Atividade } from "../types";
import { conversao } from "../lib/atividade";
import { Botao, COR, Secao } from "@/shared/components/vant-ui";

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1">
      <span className="text-[26px] font-black tabular-nums leading-none">{valor}</span>
      <span className="text-[11px] font-bold" style={{ color: COR.apagado }}>{rotulo}</span>
    </div>
  );
}

export function AtividadeCard({ atividade, carregando }: { atividade: Atividade | undefined; carregando: boolean }) {
  const navigate = useNavigate();
  if (carregando) return <Secao titulo="SUA ATIVIDADE"><SkeletonStat /></Secao>;
  const a = atividade ?? { vendas: 0, abordagens: 0, diasAtivos: 0, faturamento: 0 };
  const conv = conversao(a);
  if (a.vendas === 0 && a.diasAtivos === 0) {
    return (
      <Secao titulo="SUA ATIVIDADE" id="sec-atividade">
        <p className="text-[14px] font-bold">Nenhum Foco nos últimos 30 dias.</p>
        <p className="text-[12.5px] mt-1" style={{ color: COR.apagado }}>Suas vendas, dias na rua e conversão aparecem aqui assim que você usar o Modo Foco.</p>
        <Botao tipo="ouro" className="mt-3 w-full" onClick={() => navigate("/defcon")}>Começar um Foco</Botao>
      </Secao>
    );
  }
  return (
    <Secao titulo="SUA ATIVIDADE" id="sec-atividade" acao={<span className="text-[11px] font-bold" style={{ color: COR.apagado }}>últimos 30 dias</span>}>
      <div className="flex divide-x divide-[#22201a]">
        <Numero valor={String(a.vendas)} rotulo={a.vendas === 1 ? "venda" : "vendas"} />
        <Numero valor={String(a.diasAtivos)} rotulo={a.diasAtivos === 1 ? "dia na rua" : "dias na rua"} />
        {conv !== null
          ? <Numero valor={`${conv}%`} rotulo="conversão" />
          : <Numero valor={a.diasAtivos ? String(Math.round(a.vendas / a.diasAtivos)) : "0"} rotulo="vendas por dia" />}
      </div>
      {conv === null && <p className="text-[11.5px] mt-2.5 text-center" style={{ color: COR.apagado }}>Marque as abordagens no Foco pra ver sua conversão.</p>}
    </Secao>
  );
}
