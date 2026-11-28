/* 4 · Conectar outro banco and 5 · Organização financeira (cartões, dinheiro guardado, dívidas).
   Figures come from financas_painel() exactly as the old three rows used them; each row opens the
   same drawer as before (the inner screens are not redesigned in this stage). */
import { ChevronRight, CreditCard, Landmark, Loader2, PiggyBank, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { AbaPainel, Painel } from "@/components/financas/FinancasPainel";
import { Cartao, COR } from "@/features/financas-resumo";
import { dinheiro } from "../lib/ocultar";
import { linhasDaOrganizacao } from "../lib/organizacao";

export function ConectarBanco({ ligando, onLigar }: { ligando: boolean; onLigar: () => void }) {
  return (
    <button type="button" onClick={onLigar} disabled={ligando}
      className="w-full min-h-14 rounded-[20px] px-[18px] flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
      style={{ border: "1px dashed rgba(245,184,0,.45)", background: "transparent" }}>
      <span className="w-10 h-10 rounded-[12px] shrink-0 grid place-items-center" style={{ background: "rgba(245,184,0,.1)" }}>
        {ligando ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: COR.ouro }} /> : <Plus className="w-4 h-4" strokeWidth={2.6} style={{ color: COR.ouro }} />}
      </span>
      <span className="flex-1 text-[14.5px] font-black" style={{ color: COR.ouro }}>{ligando ? "Abrindo o banco…" : "Conectar outro banco"}</span>
      <ChevronRight className="w-4 h-4" style={{ color: COR.ouro }} aria-hidden />
    </button>
  );
}

function Linha({ icone, titulo, valor, sub, cor, oculto, onClick, primeira }: {
  icone: ReactNode; titulo: string; valor: number | null; sub: string; cor: string; oculto: boolean; onClick: () => void; primeira: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left active:opacity-70"
      style={{ borderTop: primeira ? "none" : `1px solid ${COR.linha}` }}>
      <span className="w-10 h-10 rounded-[12px] shrink-0 grid place-items-center" style={{ background: "#1a1916" }}>{icone}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-black" style={{ color: COR.texto }}>{titulo}</span>
        <span className="block text-[12px] truncate" style={{ color: COR.mute }}>{sub}</span>
      </span>
      {valor != null && <span className="text-[15px] font-black tabular-nums shrink-0" style={{ color: valor > 0 ? cor : COR.texto }}>{dinheiro(valor, oculto)}</span>}
      <ChevronRight className="w-4 h-4 shrink-0 max-[359px]:hidden" style={{ color: COR.mute }} aria-hidden />
    </button>
  );
}

export function OrganizacaoFinanceira({ p, oculto, abrir }: { p: Painel; oculto: boolean; abrir: (a: AbaPainel) => void }) {
  const l = linhasDaOrganizacao(p);
  return (
    <Cartao rotulo="Organização financeira">
      <div className="-my-2">
        <Linha primeira icone={<CreditCard className="w-[18px] h-[18px]" style={{ color: COR.ouro }} />} titulo="Cartões"
          valor={l.cartao.valor} sub={l.cartao.sub} cor={COR.texto} oculto={oculto} onClick={() => abrir("cartao")} />
        <Linha primeira={false} icone={<PiggyBank className="w-[18px] h-[18px]" style={{ color: COR.verde }} />} titulo="Dinheiro guardado"
          valor={l.guardado.valor} sub={l.guardado.sub} cor={COR.verde} oculto={oculto} onClick={() => abrir("guardado")} />
        <Linha primeira={false} icone={<Landmark className="w-[18px] h-[18px]" style={{ color: COR.vermelho }} />} titulo="Dívidas"
          valor={l.dividas.valor} sub={l.dividas.sub} cor={COR.vermelho} oculto={oculto} onClick={() => abrir("dividas")} />
      </div>
    </Cartao>
  );
}
