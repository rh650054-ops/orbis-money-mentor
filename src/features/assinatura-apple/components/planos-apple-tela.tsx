import { Check } from "lucide-react";
import type { Fase } from "../api/use-compra-apple";
import { incluiNoPlano, type PlanoDaTela } from "../lib/planos";
import type { ResultadoCompra } from "../types";
import { EstadoDaCompra } from "./estado-da-compra";
import { PaywallBeneficios, PaywallTopo } from "./paywall-beneficios";
import { PaywallRodape } from "./paywall-rodape";
import { PlanoCartao } from "./plano-cartao";

const GOLD = "#F5B800";

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

/** The paywall, drawn from what it is given (no data fetching here, so every state can be rendered
    in the tests). Order: the promise, what the app does, the plans (annual highlighted), what the
    chosen plan includes, then the fixed button. The purchase itself is confirmed on Apple's sheet. */
export function PlanosAppleTela(p: PlanosAppleTelaProps) {
  const escolhido = p.planos.find((x) => x.id === p.selecionado) ?? p.planos[p.planos.length - 1];
  const ocupado = p.fase !== "parado";
  const troca = !!p.planoAtual;

  if (p.resultado) {
    return <EstadoDaCompra resultado={p.resultado} ocupado={ocupado} onTentarDeNovo={p.onTentarDeNovo} onContinuar={p.onContinuar} onVoltar={p.onVoltar} />;
  }
  return (
    <div className="text-[#F4F1EA]">
      <PaywallTopo troca={troca} />
      {!troca && <PaywallBeneficios />}

      <section aria-label="Escolha o seu plano" className="mt-7">
        <p className="text-[11px] font-black tracking-[.18em] mb-3.5" style={{ color: "#7f7a6f" }}>ESCOLHA O SEU PLANO</p>
        <div role="radiogroup" aria-label="Planos" className="flex flex-col gap-3.5">
          {/* the annual plan first: it is the recommended one */}
          {[...p.planos].sort((a, b) => Number(b.anual) - Number(a.anual)).map((plano) => (
            <PlanoCartao key={plano.id} plano={plano} selecionado={plano.id === escolhido?.id} atual={plano.id === p.planoAtual}
              desabilitado={ocupado} onSelecionar={() => p.onSelecionar(plano.id)} />
          ))}
        </div>
      </section>

      {escolhido && (
        <section aria-label={`O que vem no ${escolhido.titulo}`} className="mt-5 rounded-[18px] px-4 py-3.5" style={{ background: "#0a0a0c", border: "1px solid #1c1b18" }}>
          <p className="text-[11px] font-black tracking-[.14em] mb-2.5" style={{ color: "#7f7a6f" }}>O QUE VEM NO {escolhido.titulo.toUpperCase()}</p>
          <ul className="grid gap-2">
            {incluiNoPlano(escolhido.id).map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[13px] font-semibold">
                <Check aria-hidden className="w-4 h-4 shrink-0" style={{ color: GOLD }} strokeWidth={3} />{item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.aviso && <p role="alert" className="text-center text-[12.5px] font-bold mt-4" style={{ color: GOLD }}>{p.aviso}</p>}

      <PaywallRodape escolhido={escolhido} troca={troca} fase={p.fase} bloqueado={escolhido?.id === p.planoAtual}
        onAssinar={p.onAssinar} onRestaurar={p.onRestaurar} onGerenciar={p.onGerenciar} onAbrirLink={p.onAbrirLink} />
    </div>
  );
}

/** Shape of the paywall while StoreKit and the server answer (skeleton, not a spinner). */
export function PlanosAppleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando planos" className="animate-pulse pt-2">
      <div className="mx-auto h-3 w-16 rounded" style={{ background: "#1c1a15" }} />
      <div className="mx-auto h-8 w-64 max-w-full rounded mt-4" style={{ background: "#17161a" }} />
      <div className="mx-auto h-4 w-56 max-w-full rounded mt-3" style={{ background: "#121114" }} />
      <div className="mt-7 space-y-3.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-[12px]" style={{ background: "#0e0e10" }} />)}</div>
      <div className="mt-7 space-y-3.5">{[104, 80, 80].map((h, i) => <div key={i} className="rounded-[20px]" style={{ height: h, background: "#0e0e10", border: "1px solid #1d1b17" }} />)}</div>
      <div className="mt-6 h-[58px] rounded-[18px]" style={{ background: "#1c1a15" }} />
    </div>
  );
}

/** No purchase is offered (a Hotmart subscriber, a courtesy...), or the store has no plan to show. */
export function PlanosAppleAviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div role="status" className="min-h-[60dvh] flex flex-col items-center justify-center text-center text-[#F4F1EA] px-2">
      <p className="text-[12px] font-black tracking-[.46em] pl-[.46em]" style={{ color: GOLD }}>VANT</p>
      <p className="text-[24px] font-black mt-5 leading-tight">{titulo}</p>
      <p className="text-[14px] mt-2.5 leading-snug max-w-[300px]" style={{ color: "#a9a397" }}>{texto}</p>
      {acao && <button type="button" onClick={acao.onClick} className="mt-7 w-full max-w-[320px] h-[52px] rounded-[16px] text-[15px] font-black" style={{ background: "#121211", border: "1px solid #2a2823" }}>{acao.rotulo}</button>}
    </div>
  );
}
