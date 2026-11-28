/* Resumo · 2 · Dinheiro disponível (moved here 28/11 so the Resumo and the Bancos read ONE
   definition, lib/saldo.ts). Same card, same look as the approved Resumo: only the money with a
   recent read is the big number; the rest is labelled under it. */
import { Briefcase, User } from "lucide-react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { Atalho, Cartao, COR, Divisor, reais, Titulo, Valor } from "@/features/financas-resumo";
import { distribuicao, type Consolidado } from "../lib/saldo";
import { CabecaDoSaldo, LinhasDoSaldo, NumeroDoSaldo } from "./linhas-do-saldo";

const comSinal = (v: number) => (v < 0 ? `− ${reais(Math.abs(v))}` : reais(v));

function Lado({ rotulo, v, icone }: { rotulo: string; v: number | null; icone: React.ReactNode }) {
  return v == null
    ? <div className="min-w-0"><p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}>{icone}{rotulo}</p>
        <p className="text-[13px] font-bold mt-1.5" style={{ color: COR.mute }}>sem leitura recente</p></div>
    : <Valor rotulo={rotulo} valor={comSinal(v)} cor={v < 0 ? COR.vermelho : COR.texto} icone={icone} />;
}

export function DinheiroDisponivel({ h, c, onVerBancos }: { h: HomeFinancas; c: Consolidado; onVerBancos: () => void }) {
  const negativo = c.conferido && (c.recente ?? 0) < 0;
  const dois = c.partes.trabalho.contas > 0 && c.partes.pessoal.contas > 0;
  const barra = dois ? distribuicao(c) : null;
  return (
    <Cartao rotulo="Dinheiro disponível" tom={negativo ? "vermelho" : "normal"}>
      <CabecaDoSaldo c={c}><Titulo cor={negativo ? COR.vermelho : COR.sub}>{negativo ? "Você está no negativo" : "Dinheiro disponível"}</Titulo></CabecaDoSaldo>
      <div className="mt-1"><NumeroDoSaldo c={c} oculto={false} tamanho={32} /></div>
      <LinhasDoSaldo c={c} oculto={false} />
      {c.conferido && c.recente != null && dois && (
        <>
          <Divisor />
          <div className="grid grid-cols-2 gap-4">
            <Lado rotulo="Trabalho" v={c.partes.trabalho.recente} icone={<Briefcase className="w-3.5 h-3.5" style={{ color: COR.ouro }} aria-hidden />} />
            <Lado rotulo="Pessoal" v={c.partes.pessoal.recente} icone={<User className="w-3.5 h-3.5" style={{ color: COR.azul }} aria-hidden />} />
          </div>
          {barra && (
            <div className="flex h-[6px] rounded-full overflow-hidden mt-3.5 gap-[3px]" role="img" aria-label={`${barra.trabalho}% trabalho, ${barra.pessoal}% pessoal`}>
              {barra.trabalho > 0 && <span className="h-full rounded-full" style={{ width: `${barra.trabalho}%`, background: COR.ouro }} />}
              {barra.pessoal > 0 && <span className="h-full rounded-full" style={{ width: `${barra.pessoal}%`, background: COR.azul }} />}
              {barra.sem > 0 && <span className="h-full rounded-full" style={{ width: `${barra.sem}%`, background: "#6d685e" }} />}
            </div>
          )}
        </>
      )}
      {negativo && h.causas && h.causas.length > 0 && (
        <div className="rounded-xl px-3 py-1 mt-4" style={{ background: "rgba(0,0,0,.35)" }}>
          <p className="text-[10px] font-black tracking-[.14em] pt-2" style={{ color: COR.mute }}>O QUE MAIS SAIU NESSES 7 DIAS</p>
          {h.causas.slice(0, 3).map((x, i) => (
            <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: i === 0 ? "none" : `1px solid ${COR.linha}` }}>
              <span className="flex-1 min-w-0 text-[13px] font-extrabold truncate">{x.descricao}</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: COR.vermelho }}>− {reais(x.valor)}</span>
            </div>
          ))}
        </div>
      )}
      <Atalho onClick={onVerBancos}>Ver minhas contas</Atalho>
    </Cartao>
  );
}
