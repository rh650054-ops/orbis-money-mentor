/* 4 · Meu negócio: what the DEFCON recorded this month (daily_sales + personal_expenses).
   The figures are the page's summary, untouched; costs and margin keep the old card's formulas. */
import { Cartao, COR, Divisor, reais, Titulo, Valor, AnelMargem } from "./pecas";

export interface NegocioProps {
  carregando: boolean;
  faturamento: number;
  lucro: number;
  vendidoHoje: number;
  lucroHoje: number;
  mediaDiaria: number;
  fiadoHoje: number;
}

/** Same formulas as the old "Seu mês" card (Finances.tsx, 04/10). Exported for the tests. */
export function custosEMargem(faturamento: number, lucro: number) {
  const vendido = Number(faturamento) || 0;
  return {
    custos: Math.max(0, vendido - lucro),
    margem: vendido > 0 ? Math.max(0, Math.min(100, (lucro / vendido) * 100)) : 0,
  };
}

function Linha({ rotulo, valor, sub, cor = COR.texto }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3" style={{ borderTop: `1px solid ${COR.linha}` }}>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold" style={{ color: COR.sub }}>{rotulo}</p>
        {sub && <p className="text-[12px] mt-0.5" style={{ color: COR.mute }}>{sub}</p>}
      </div>
      <p className="text-[16px] font-black tabular-nums shrink-0" style={{ color: cor }}>{valor}</p>
    </div>
  );
}

export function MeuNegocio(p: NegocioProps) {
  if (p.carregando) {
    return (
      <Cartao rotulo="Meu negócio">
        <Titulo>Lucro do mês</Titulo>
        <div aria-busy="true" className="h-9 w-44 rounded-lg mt-3 animate-pulse" style={{ background: "#1f1e1a" }} />
      </Cartao>
    );
  }
  const { custos, margem } = custosEMargem(p.faturamento, p.lucro);
  const prejuizo = p.lucro < 0;
  return (
    <Cartao rotulo="Meu negócio">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Titulo>{prejuizo ? "Prejuízo do mês" : "Lucro do mês"}</Titulo>
          <p className="text-[30px] font-black tabular-nums leading-none tracking-tight mt-2.5 truncate"
            style={{ color: prejuizo ? COR.vermelho : p.lucro > 0 ? COR.verde : COR.texto }}>
            {prejuizo ? `− ${reais(Math.abs(p.lucro))}` : reais(p.lucro)}
          </p>
          <p className="text-[12.5px] mt-2" style={{ color: COR.mute }}>depois dos custos registrados</p>
        </div>
        <AnelMargem pct={margem} cor={margem >= 50 ? COR.verde : COR.ouro} />
      </div>
      <Divisor />
      <div className="grid grid-cols-2 gap-4">
        <Valor rotulo="Faturamento" valor={reais(p.faturamento)} />
        <Valor rotulo="Custos" valor={reais(custos)} cor={custos > 0 ? COR.vermelho : COR.texto} />
      </div>
      <div className="mt-4 -mb-3">
        <Linha rotulo="Vendido hoje" valor={reais(p.vendidoHoje)}
          sub={p.vendidoHoje > 0 ? `lucro de hoje ${p.lucroHoje < 0 ? "− " : ""}${reais(Math.abs(p.lucroHoje))}` : undefined} />
        <Linha rotulo="Média diária" valor={reais(p.mediaDiaria)} sub="de lucro por dia com venda" />
        {p.fiadoHoje > 0 && <Linha rotulo="Fiado hoje" valor={reais(p.fiadoHoje)} cor="#F2B43A" sub="entra no lucro quando cair" />}
      </div>
    </Cartao>
  );
}
