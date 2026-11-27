import { Check, ChevronLeft, Loader2 } from "lucide-react";
import type { Fase } from "../api/use-compra-apple";
import { SO_NO_ANUAL, incluiNoPlano, type PlanoDaTela } from "../lib/planos";
import { PaywallMiolo } from "./paywall-miolo";

const GOLD = "#F5B800";
const FRACO = "#7f7a6f";
const soNoAnual = new Set(Object.values(SO_NO_ANUAL));

/** Second paywall screen (Paywall V3): one plan, what it includes, how it is charged and renewed,
    and Apple's native purchase. "Escolher outro plano" goes back to the three cards. */
export function PaywallDetalhe({ plano, troca, atual, fase, aviso, onVoltar, onAssinar, onRestaurar, onGerenciar, onAbrirLink }: {
  plano: PlanoDaTela; troca: boolean; atual: boolean; fase: Fase; aviso?: string | null;
  onVoltar: () => void; onAssinar: () => void; onRestaurar: () => void; onGerenciar?: () => void;
  onAbrirLink: (c: "/termos" | "/privacidade") => void;
}) {
  const ocupado = fase !== "parado";
  const rotulo = fase === "comprando" ? "Abrindo a App Store..." : fase === "verificando" ? "Confirmando com a Apple..."
    : atual ? "Seu plano atual" : `${troca ? "Trocar para" : "Assinar"} ${plano.titulo}`;
  const link = "underline underline-offset-[3px] disabled:opacity-60";
  const rodape = (
    <>
      <button type="button" onClick={onAssinar} disabled={ocupado || atual}
        className="w-full min-h-[56px] rounded-[18px] px-4 py-2 flex flex-col items-center justify-center active:scale-[.99] transition-transform disabled:opacity-60"
        style={{ color: "#1A1200", background: "linear-gradient(180deg,#FFE58A 0%,#F5B800 58%,#D9A000 100%)", boxShadow: "0 12px 34px -14px rgba(245,184,0,.7)" }}>
        <span className="flex items-center gap-2 text-[16px] font-black leading-tight">{ocupado && <Loader2 aria-hidden className="w-4 h-4 animate-spin" />}{rotulo}</span>
        {!ocupado && !atual && <span className="text-[12px] font-bold opacity-80">{plano.preco}{plano.periodo}</span>}
      </button>
      <p className="text-center text-[10.5px] mt-2 leading-snug" style={{ color: FRACO }}>
        Ao assinar, você concorda com os{" "}
        <button type="button" onClick={() => onAbrirLink("/termos")} className={link}>Termos de Uso</button> e a{" "}
        <button type="button" onClick={() => onAbrirLink("/privacidade")} className={link}>Política de Privacidade</button>.
      </p>
    </>
  );
  return (
    <PaywallMiolo rodape={rodape}>
      <button type="button" onClick={onVoltar} disabled={ocupado} className="-ml-1 h-10 inline-flex items-center gap-1 text-[13px] font-bold disabled:opacity-60" style={{ color: "#b9b3a6" }}>
        <ChevronLeft aria-hidden className="w-4 h-4" /> Escolher outro plano
      </button>
      <section aria-label={plano.titulo} className="mt-2">
        {plano.anual && <p className="text-[10px] font-black tracking-[.14em]" style={{ color: GOLD }}>MELHOR CUSTO-BENEFÍCIO</p>}
        <h2 className="text-[26px] font-black leading-tight mt-1" style={{ color: plano.anual ? GOLD : "#F4F1EA" }}>{plano.titulo}</h2>
        <p className="flex items-baseline gap-1.5 mt-1.5 leading-none">
          <span className="text-[30px] font-black tracking-[-.02em] tabular-nums">{plano.preco}</span>
          <span className="text-[14px] font-bold" style={{ color: "#a9a397" }}>{plano.periodo}</span>
        </p>
        {plano.anual && plano.equivalente && <p className="text-[12.5px] mt-2" style={{ color: "#a9a397" }}>Cobrado uma vez por ano. Equivale a {plano.equivalente} por mês.</p>}
        {plano.economia ? <p className="text-[12.5px] font-bold mt-1" style={{ color: "#49d98a" }}>Economize {plano.economia}% em relação ao Pro mensal.</p> : null}
        {!plano.anual && <p className="text-[12.5px] mt-2" style={{ color: "#a9a397" }}>{plano.linha}</p>}
      </section>
      <section aria-label={`O que vem no ${plano.titulo}`} className="mt-5 rounded-[18px] px-4 py-3.5" style={{ background: "#0a0a0c", border: "1px solid #1c1b18" }}>
        <p className="text-[11px] font-black tracking-[.14em] mb-2.5" style={{ color: FRACO }}>O QUE VEM NO PLANO</p>
        <ul className="grid gap-2">
          {incluiNoPlano(plano.id).map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-[13px] font-semibold">
              <Check aria-hidden className="w-4 h-4 shrink-0" style={{ color: GOLD }} strokeWidth={3} />{item}
              {soNoAnual.has(item) && <span className="shrink-0 whitespace-nowrap rounded-[6px] px-1.5 py-[2px] text-[9px] font-black tracking-[.08em]" style={{ background: "rgba(245,184,0,.14)", color: GOLD }}>SÓ NO ANUAL</span>}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Cobrança e renovação" className="mt-4">
        <p className="text-[11px] font-black tracking-[.14em] mb-1.5" style={{ color: FRACO }}>COBRANÇA E RENOVAÇÃO</p>
        <p className="text-[12px] leading-snug" style={{ color: "#a9a397" }}>
          {plano.preco} {plano.anual ? "cobrados uma vez por ano" : "cobrados todo mês"} na sua conta Apple, ao confirmar a compra. A assinatura renova
          automaticamente pelo mesmo valor e período, a menos que seja cancelada até 24 horas antes do fim do período. Cancele quando quiser nos Ajustes da Apple.
        </p>
      </section>
      {atual && <p className="text-[12px] font-bold mt-3" style={{ color: "#b9b3a6" }}>Este já é o seu plano. Para trocar, escolha outro plano.</p>}
      {aviso && <p role="alert" className="text-center text-[12.5px] font-bold mt-4" style={{ color: GOLD }}>{aviso}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-bold" style={{ color: "#a9a397" }}>
        <button type="button" onClick={onRestaurar} disabled={ocupado} className={link}>{fase === "restaurando" ? "Procurando suas compras..." : "Restaurar compras"}</button>
        {troca && onGerenciar && <button type="button" onClick={onGerenciar} className={link}>Gerenciar assinatura na Apple</button>}
      </div>
    </PaywallMiolo>
  );
}
