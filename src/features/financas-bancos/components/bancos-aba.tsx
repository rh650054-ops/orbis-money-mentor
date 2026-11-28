/* Finanças · Bancos (redesign 28/11/2026): saldo → contas de trabalho → contas pessoais →
   conectar outro banco → organização financeira → reserva. Reuses the Vender screen's bank list,
   status rule, connect flow (plan and bank-limit rules) and management sheet, unchanged. */
import { useState } from "react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { PainelGaveta, type AbaPainel } from "@/components/financas/FinancasPainel";
import { ReservaCaixinha } from "@/components/financas/ReservaCaixinha";
import { BancoExtra } from "@/components/conectar/PapelContas";
import { GerenciarFolha, useAtualizarAgoraMutation, useBancosQuery, useLigarBanco } from "@/features/vender";
import { COR } from "@/features/financas-resumo";
import { usePainelQuery } from "../api/use-painel-query";
import { agrupar } from "../lib/contas";
import { useOcultarValores } from "../lib/ocultar";
import { SaldoDisponivel } from "./saldo-disponivel";
import { GrupoContas } from "./grupo-contas";
import { ConectarBanco, OrganizacaoFinanceira } from "./organizacao";

interface Props { h: HomeFinancas; userId: string | undefined; email?: string | null; onGerenciar: () => void; onMudou: () => void }

export function BancosAba({ h, userId, email, onGerenciar, onMudou }: Props) {
  const { oculto, alternar } = useOcultarValores();
  const bancosQ = useBancosQuery(userId);
  const painelQ = usePainelQuery(userId);
  const banco = useLigarBanco(true);
  const atualizar = useAtualizarAgoraMutation();
  const [folha, setFolha] = useState(false);
  const [gaveta, setGaveta] = useState<AbaPainel | null>(null);
  const g = agrupar(h, bancosQ.data?.bancos ?? []);
  const comuns = { oculto, ligando: banco.ligando, onAbrir: () => setFolha(true), onAutorizar: (item: string) => void banco.ligar(item) };

  return (
    <>
      <SaldoDisponivel h={h} oculto={oculto} onOcultar={alternar} />
      <div className="flex items-baseline justify-between pt-2 -mb-1">
        <h2 className="text-[17px] font-black" style={{ color: COR.texto }}>Suas contas</h2>
        <button type="button" onClick={onGerenciar} className="text-[12.5px] font-extrabold min-h-9" style={{ color: COR.ouro }}>Gerenciar</button>
      </div>
      <GrupoContas tipo="sem" linhas={g.semPapel} {...comuns} />
      <GrupoContas tipo="trabalho" linhas={g.trabalho} {...comuns} />
      <GrupoContas tipo="pessoal" linhas={g.pessoal} {...comuns} />
      {banco.precisaExtra && <BancoExtra usados={bancosQ.data?.bancos.length ?? 0} email={email} onFechar={banco.fecharExtra} />}
      <ConectarBanco ligando={banco.ligando} onLigar={() => void banco.ligar()} />

      {painelQ.data && (
        <>
          <h2 className="text-[17px] font-black pt-2 -mb-1" style={{ color: COR.texto }}>Organização financeira</h2>
          <OrganizacaoFinanceira p={painelQ.data} oculto={oculto} abrir={setGaveta} />
          <PainelGaveta p={painelQ.data} aba={gaveta} onFechar={() => setGaveta(null)} />
        </>
      )}
      {/* the emergency reserve is a "caixinha" the person picks (04/10): same card, unchanged */}
      <ReservaCaixinha userId={userId} />

      {bancosQ.data && (
        <GerenciarFolha aberta={folha} onFechar={() => { setFolha(false); onMudou(); }} bancos={bancosQ.data.bancos} contas={bancosQ.data.contas}
          atualizando={atualizar.isPending} onAtualizar={() => atualizar.mutate()} />
      )}
    </>
  );
}
