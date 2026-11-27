import type { Fase } from "../api/use-compra-apple";
import type { PlanoDaTela } from "../lib/planos";
import type { ResultadoCompra } from "../types";
import { EstadoDaCompra } from "./estado-da-compra";
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

/** The plans screen, drawn from what it is given (no data fetching here, so every state can be
    rendered in the tests and in the previews). The purchase itself is confirmed on Apple's sheet. */
export function PlanosAppleTela(p: PlanosAppleTelaProps) {
  const escolhido = p.planos.find((x) => x.id === p.selecionado) ?? p.planos[p.planos.length - 1];
  const ocupado = p.fase !== "parado";
  const troca = !!p.planoAtual;
  return (
    <div className="text-[#F4F1EA]">
      <p className="text-center text-[13px] font-black tracking-[.42em]" style={{ color: GOLD }}>VANT</p>
      <h1 className="text-center text-[21px] font-black tracking-[-.02em] mt-2 leading-tight">Eleve o nível das suas vendas.</h1>
      <p className="text-center text-[12.5px] mt-1" style={{ color: "#8f897c" }}>{troca ? "Troque de plano quando quiser." : "Escolha o plano ideal para sua jornada."}</p>

      {p.resultado ? (
        <div className="mt-5"><EstadoDaCompra resultado={p.resultado} ocupado={ocupado} onTentarDeNovo={p.onTentarDeNovo} onContinuar={p.onContinuar} onVoltar={p.onVoltar} /></div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Planos" className="mt-5 space-y-2.5">
            {p.planos.map((plano) => (
              <PlanoCartao key={plano.id} plano={plano} selecionado={plano.id === escolhido?.id} atual={plano.id === p.planoAtual}
                desabilitado={ocupado} onSelecionar={() => p.onSelecionar(plano.id)} />
            ))}
          </div>

          <button type="button" onClick={p.onAssinar} disabled={ocupado || !escolhido || escolhido.id === p.planoAtual}
            className="mt-4 w-full h-[54px] rounded-[16px] text-[15.5px] font-black active:translate-y-[1px] disabled:opacity-60"
            style={{ color: "#1A1200", background: "linear-gradient(180deg,#FFE27A 0%,#F5B800 60%,#D9A000 100%)" }}>
            {p.fase === "comprando" ? "Abrindo a App Store..." : troca ? `Trocar para ${escolhido?.titulo ?? ""}` : `Assinar ${escolhido?.titulo ?? ""}`}
          </button>
          {escolhido && (
            <p className="text-center text-[11px] mt-2 leading-snug" style={{ color: "#8f897c" }}>
              {escolhido.preco} {escolhido.anual ? "cobrados uma vez por ano" : "por mês"}. Renovação automática. Cancele quando quiser nos Ajustes da Apple.
            </p>
          )}
          {p.aviso && <p role="alert" className="text-center text-[12px] font-bold mt-3" style={{ color: GOLD }}>{p.aviso}</p>}

          <div className="mt-4 flex flex-col items-center gap-2 text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
            <button type="button" onClick={p.onRestaurar} disabled={ocupado} className="underline underline-offset-[3px] disabled:opacity-60">
              {p.fase === "restaurando" ? "Procurando suas compras..." : "Restaurar compras"}
            </button>
            {troca && p.onGerenciar && <button type="button" onClick={p.onGerenciar} className="underline underline-offset-[3px]">Gerenciar assinatura na Apple</button>}
            <span className="text-[11.5px]" style={{ color: "#7b766e" }}>
              <button type="button" onClick={() => p.onAbrirLink("/termos")} className="underline underline-offset-[3px]">Termos de Uso</button>
              {" · "}
              <button type="button" onClick={() => p.onAbrirLink("/privacidade")} className="underline underline-offset-[3px]">Privacidade</button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** Shape of the screen while StoreKit and the server answer (skeleton, not a spinner). */
export function PlanosAppleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando planos" className="animate-pulse">
      <div className="mx-auto h-3 w-20 rounded" style={{ background: "#1c1a15" }} />
      <div className="mx-auto h-5 w-64 max-w-full rounded mt-3" style={{ background: "#17161a" }} />
      <div className="mt-6 space-y-2.5">
        {[88, 88, 168].map((h, i) => <div key={i} className="rounded-[18px]" style={{ height: h, background: "#0e0e10", border: "1px solid #1d1b17" }} />)}
      </div>
      <div className="mt-4 h-[54px] rounded-[16px]" style={{ background: "#1c1a15" }} />
    </div>
  );
}

/** No purchase is offered (a Hotmart subscriber, a courtesy...), or the store has no plan to show. */
export function PlanosAppleAviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div role="status" className="rounded-[22px] border px-5 py-7 text-center text-[#F4F1EA]" style={{ background: "#0b0b0d", borderColor: "#26241f" }}>
      <p className="text-[13px] font-black tracking-[.42em]" style={{ color: GOLD }}>VANT</p>
      <p className="text-[20px] font-black mt-4 leading-tight">{titulo}</p>
      <p className="text-[13.5px] mt-2 leading-snug" style={{ color: "#b9b3a6" }}>{texto}</p>
      {acao && <button type="button" onClick={acao.onClick} className="mt-5 w-full h-[50px] rounded-[14px] text-[14.5px] font-black" style={{ background: "#121211", border: "1px solid #2a2823" }}>{acao.rotulo}</button>}
    </div>
  );
}
