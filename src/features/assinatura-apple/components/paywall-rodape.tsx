import { Loader2 } from "lucide-react";
import type { Fase } from "../api/use-compra-apple";
import type { PlanoDaTela } from "../lib/planos";

/** The bottom of the paywall. Only the button (named after the chosen plan, with its price) stays
    fixed above the home indicator; the renewal terms and the legal links follow in the page, so the
    fixed band never covers the plan details. The plan the account already has reads "Seu plano atual". */
export function PaywallRodape({ escolhido, troca, fase, bloqueado, onAssinar, onRestaurar, onGerenciar, onAbrirLink }: {
  escolhido: PlanoDaTela | undefined; troca: boolean; fase: Fase; bloqueado: boolean;
  onAssinar: () => void; onRestaurar: () => void; onGerenciar?: () => void; onAbrirLink: (c: "/termos" | "/privacidade") => void;
}) {
  const ocupado = fase !== "parado";
  const rotulo = fase === "comprando" ? "Abrindo a App Store..." : fase === "verificando" ? "Confirmando com a Apple..."
    : bloqueado ? "Seu plano atual"
    : `${troca ? "Trocar para" : "Assinar"} ${escolhido?.titulo ?? ""}`.trim();
  const link = "underline underline-offset-[3px] disabled:opacity-60";
  return (
    <>
    {/* only the button stays fixed (about 90 px), on a solid band: nothing of the page shows through it */}
    <div className="sticky bottom-0 z-10 -mx-5 px-5 pt-3 mt-6 pb-[max(12px,env(safe-area-inset-bottom))]" style={{ background: "#000", boxShadow: "0 -18px 18px -6px #000" }}>
      <button type="button" onClick={onAssinar} disabled={ocupado || bloqueado || !escolhido}
        className="w-full min-h-[58px] rounded-[18px] px-4 py-2 flex flex-col items-center justify-center active:scale-[.99] transition-transform disabled:opacity-60"
        style={{ color: "#1A1200", background: "linear-gradient(180deg,#FFE58A 0%,#F5B800 58%,#D9A000 100%)", boxShadow: "0 12px 34px -14px rgba(245,184,0,.7)" }}>
        <span className="flex items-center gap-2 text-[16px] font-black leading-tight">
          {ocupado && <Loader2 aria-hidden className="w-4 h-4 animate-spin" />}{rotulo}
        </span>
        {!ocupado && escolhido && !bloqueado && <span className="text-[12px] font-bold opacity-80">{escolhido.preco}{escolhido.periodo}</span>}
      </button>
    </div>
    <div className="pb-safe">
      {bloqueado && <p className="text-center text-[12px] font-bold mt-3" style={{ color: "#b9b3a6" }}>Para trocar, escolha outro plano acima.</p>}
      {escolhido && (
        <p className="text-center text-[10.5px] mt-2.5 leading-snug" style={{ color: "#7f7a6f" }}>
          {escolhido.preco} {escolhido.anual ? "cobrados uma vez por ano" : "por mês"}. Renovação automática. Cancele quando quiser nos Ajustes da Apple. Ao assinar, você concorda com os Termos de Uso e a Política de Privacidade.
        </p>
      )}
      <div className="mt-2.5 mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] font-bold" style={{ color: "#a9a397" }}>
        <button type="button" onClick={onRestaurar} disabled={ocupado} className={link}>{fase === "restaurando" ? "Procurando suas compras..." : "Restaurar compras"}</button>
        {troca && onGerenciar && <button type="button" onClick={onGerenciar} className={link}>Gerenciar assinatura na Apple</button>}
        <button type="button" onClick={() => onAbrirLink("/termos")} className={link}>Termos de Uso</button>
        <button type="button" onClick={() => onAbrirLink("/privacidade")} className={link}>Privacidade</button>
      </div>
    </div>
    </>
  );
}
