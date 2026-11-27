import { useState } from "react";
import type { Fase } from "../api/use-compra-apple";
import type { PlanoDaTela } from "../lib/planos";
import { PRODUTO, type ResultadoCompra } from "../types";
import { EstadoDaCompra } from "./estado-da-compra";
import { PaywallDetalhe } from "./paywall-detalhe";
import { PaywallMiolo } from "./paywall-miolo";
import { PaywallTopo } from "./paywall-topo";
import { PlanoCartao } from "./plano-cartao";

const GOLD = "#F5B800";
const ORDEM: string[] = [PRODUTO.proAnual, PRODUTO.proMensal, PRODUTO.essencial];

export interface PlanosAppleTelaProps {
  planos: PlanoDaTela[];
  selecionado: string;
  onSelecionar: (id: string) => void;
  /** the plan this account already has through Apple (then the button changes it) */
  planoAtual?: string | null;
  fase: Fase;
  resultado: ResultadoCompra | null;
  aviso?: string | null;
  onAssinar: () => void;
  onRestaurar: () => void;
  onGerenciar?: () => void;
  onTentarDeNovo: () => void;
  onContinuar: () => void;
  onVoltar: () => void;
  onAbrirLink: (caminho: "/termos" | "/privacidade") => void;
}

/** Paywall V3 (27/11/2026), drawn from what it is given (no data fetching here, so every state can
    be rendered in the tests). Two screens in the same component, never a stack of dialogs:
    1. "Escolha seu plano": the promise and three compact cards (annual first and highlighted);
    2. the chosen plan's details, with Apple's native purchase and "Escolher outro plano".
    The purchase itself is confirmed on Apple's sheet. */
export function PlanosAppleTela(p: PlanosAppleTelaProps) {
  const [detalhe, setDetalhe] = useState(false);
  const ocupado = p.fase !== "parado";
  const troca = !!p.planoAtual;
  const escolhido = p.planos.find((x) => x.id === p.selecionado);
  const link = "underline underline-offset-[3px] disabled:opacity-60";

  if (p.resultado) {
    return (
      <PaywallMiolo>
        <EstadoDaCompra resultado={p.resultado} ocupado={ocupado} onTentarDeNovo={p.onTentarDeNovo} onContinuar={p.onContinuar}
          onVoltar={() => { setDetalhe(false); p.onVoltar(); }} />
      </PaywallMiolo>
    );
  }
  if (detalhe && escolhido) {
    return <PaywallDetalhe plano={escolhido} troca={troca} atual={escolhido.id === p.planoAtual} fase={p.fase} aviso={p.aviso}
      onVoltar={() => setDetalhe(false)} onAssinar={p.onAssinar} onRestaurar={p.onRestaurar} onGerenciar={p.onGerenciar} onAbrirLink={p.onAbrirLink} />;
  }
  return (
    <PaywallMiolo>
      <div className="text-[#F4F1EA]">
        <PaywallTopo troca={troca} />
        <section aria-label="Escolha seu plano" className="mt-6 flex flex-col gap-3">
          {/* Pro anual (the recommended one), Pro mensal, Essencial */}
          {[...p.planos].sort((a, b) => ORDEM.indexOf(a.id) - ORDEM.indexOf(b.id)).map((plano) => (
            <PlanoCartao key={plano.id} plano={plano} atual={plano.id === p.planoAtual} desabilitado={ocupado}
              onAbrir={() => { p.onSelecionar(plano.id); setDetalhe(true); }} />
          ))}
        </section>
        {p.aviso && <p role="alert" className="text-center text-[12.5px] font-bold mt-4" style={{ color: GOLD }}>{p.aviso}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] font-bold" style={{ color: "#a9a397" }}>
          <button type="button" onClick={p.onRestaurar} disabled={ocupado} className={link}>{p.fase === "restaurando" ? "Procurando suas compras..." : "Restaurar compras"}</button>
          {troca && p.onGerenciar && <button type="button" onClick={p.onGerenciar} className={link}>Gerenciar assinatura na Apple</button>}
          <button type="button" onClick={() => p.onAbrirLink("/termos")} className={link}>Termos de Uso</button>
          <button type="button" onClick={() => p.onAbrirLink("/privacidade")} className={link}>Privacidade</button>
        </div>
      </div>
    </PaywallMiolo>
  );
}

/** Shape of the paywall while StoreKit and the server answer (skeleton, not a spinner). */
export function PlanosAppleSkeleton() {
  return (
    <PaywallMiolo>
    <div aria-busy="true" aria-label="Carregando planos" className="animate-pulse pt-2">
      <div className="mx-auto h-3 w-16 rounded" style={{ background: "#1c1a15" }} />
      <div className="mx-auto h-8 w-64 max-w-full rounded mt-4" style={{ background: "#17161a" }} />
      <div className="mx-auto h-4 w-56 max-w-full rounded mt-3" style={{ background: "#121114" }} />
      <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[66px] rounded-[18px]" style={{ background: "#0e0e10", border: "1px solid #1d1b17" }} />)}</div>
    </div>
    </PaywallMiolo>
  );
}

/** No purchase is offered (a Hotmart subscriber, a courtesy...), or the store has no plan to show. */
export function PlanosAppleAviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <PaywallMiolo>
    <div role="status" className="min-h-[60dvh] flex flex-col items-center justify-center text-center text-[#F4F1EA] px-2">
      <p className="text-[12px] font-black tracking-[.46em] pl-[.46em]" style={{ color: GOLD }}>VANT</p>
      <p className="text-[24px] font-black mt-5 leading-tight">{titulo}</p>
      <p className="text-[14px] mt-2.5 leading-snug max-w-[300px]" style={{ color: "#a9a397" }}>{texto}</p>
      {acao && <button type="button" onClick={acao.onClick} className="mt-7 w-full max-w-[320px] h-[52px] rounded-[16px] text-[15px] font-black" style={{ background: "#121211", border: "1px solid #2a2823" }}>{acao.rotulo}</button>}
    </div>
    </PaywallMiolo>
  );
}
