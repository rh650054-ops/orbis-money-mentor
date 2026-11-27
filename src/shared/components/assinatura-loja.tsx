/* App da loja (cobranca-loja.ts):
 *  - "link" (modelo Néctar, padrão): sem preço nem checkout no app. Um cartão/tela com
 *    "Assinar" que abre o site da VANT no navegador, "Tentar novamente" e "Sair da conta".
 *  - "fora" (reserva): aviso neutro, só suporte. */
import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ExternalLink, LogOut, RefreshCw, X } from "lucide-react";
import { EVENTO_ASSINATURA_LOJA, assinaPelaApple, assinaPeloSite, podeMostrarAssinatura } from "@/shared/lib/cobranca-loja";
import { abrirLinkExterno } from "@/shared/lib/link-externo";
import { abrirAssinarNoSite, abrirRenovarNoSite } from "@/shared/lib/assinar-no-site";

// iPhone with native billing (27/11/2026): the plans screen of the feature, loaded only there
const PlanosApple = lazy(() => import("@/features/assinatura-apple").then((m) => ({ default: m.PlanosApple })));

/** "apple" mode: Apple's native plans screen wherever the store app would show "assinar".
 *  telaCheia (27/11/2026): a full-screen paywall over the app, respecting the iPhone's safe areas,
 *  used where the paywall interrupts (end of trial, "assinar" taps). Inline inside pages otherwise.
 *
 *  Scrolling (Paywall V3, 27/11/2026: builds 17 and 18 did not scroll on the iPhone): the fixed
 *  frame never scrolls itself. It is a column (header + body) like the screens that scroll on the
 *  iPhone (the VANT IA chat, the welcome tour); the scrolling happens inside the body (PaywallMiolo,
 *  flex-1 min-h-0 overflow-y-auto) and the purchase button is the body's own last row. No dialog
 *  library, no stack of dialogs, no hand-made page lock. */
export function TelaAssinarPelaApple({ onLiberada, aoTerPlano, onFechar, telaCheia, onVerificar, verificando, onSair }: {
  onLiberada?: () => void; aoTerPlano?: () => void; onFechar?: () => void; telaCheia?: boolean;
  onVerificar?: () => void; verificando?: boolean; onSair?: () => void;
}) {
  const planos = (
    <Suspense fallback={<div aria-busy="true" className="h-[300px] rounded-[18px] animate-pulse" style={{ background: "#0e0e10" }} />}>
      <PlanosApple onLiberada={onLiberada} aoTerPlano={aoTerPlano} />
    </Suspense>
  );
  if (!telaCheia) return (
    <div className="rounded-[22px] px-4 py-5" style={{ background: "#000" }}>
      {planos}
      {onFechar && <button type="button" onClick={onFechar} className="mt-3 w-full h-10 text-[12.5px] font-extrabold" style={{ color: "#8f897c" }}>agora não</button>}
    </div>
  );
  return <MolduraPaywall onSair={onSair} onVerificar={onVerificar} verificando={verificando} onFechar={onFechar}>{planos}</MolduraPaywall>;
}

/** The full-screen frame of the Apple paywall (Paywall V3): a fixed column that never scrolls
    itself (header + body). What scrolls is the body inside (PaywallMiolo). Exported for the preview. */
export function MolduraPaywall({ children, onSair, onVerificar, verificando, onFechar }: {
  children: ReactNode; onSair?: () => void; onVerificar?: () => void; verificando?: boolean; onFechar?: () => void;
}) {
  const fraco = { color: "#8f897c" };
  return (
    <div role="dialog" aria-modal="true" aria-label="Planos da VANT" className="fixed inset-0 z-[210] flex flex-col text-[#F4F1EA]"
      style={{ background: "radial-gradient(120% 55% at 50% 0%, #1b1404 0%, #050403 48%, #000 100%)" }}>
      <div className="mx-auto w-full max-w-[440px] flex-1 min-h-0 flex flex-col px-5 pt-safe">
        <div className="flex items-center justify-between h-12 shrink-0">
          {onSair ? <button type="button" onClick={onSair} className="h-10 -ml-1 px-1 inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={fraco}><LogOut className="w-3.5 h-3.5" /> Sair da conta</button> : <span />}
          {onVerificar && (
            <button type="button" onClick={onVerificar} disabled={verificando} className="h-10 -mr-1 px-1 inline-flex items-center gap-1.5 text-[12.5px] font-bold disabled:opacity-60" style={fraco}>
              <RefreshCw className={`w-3.5 h-3.5 ${verificando ? "animate-spin" : ""}`} /> {verificando ? "Verificando..." : "Já paguei, verificar acesso"}
            </button>
          )}
          {onFechar && <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 -mr-2 rounded-full inline-flex items-center justify-center" style={{ ...fraco, background: "rgba(255,255,255,.06)" }}><X className="w-[18px] h-[18px]" /></button>}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

const SUPORTE = "https://wa.me/5511915054830?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20minha%20conta%20da%20Vant";
const GOLD = "#F5B800";

const btn = (extra: string) => `w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black ${extra}`;

/** Store app, no access (Rick, 24/11/2026):
 *  - ex-subscriber ("renovar"): yellow RENOVAR ASSINATURA → Hotmart checkout of the plan they had;
 *  - trial ended / never paid ("assinar"): yellow VER PLANOS E ASSINAR → /assinar (all plans);
 *  then "Já paguei, verificar acesso", "Falar com o suporte" and "Sair da conta". */
export function TelaAssinarPeloSite({ titulo, texto, onTentar, tentando, onSair, renovacao, modo = "assinar" }: {
  titulo?: string; texto?: ReactNode; onTentar?: () => void; tentando?: boolean; onSair?: () => void;
  /** Pix da renovação em aberto: vira o botão principal; o amarelo vira "Trocar de plano" */
  renovacao?: ReactNode;
  modo?: "assinar" | "renovar";
}) {
  const principal = renovacao ? "Trocar de plano" : modo === "renovar" ? "RENOVAR ASSINATURA" : "VER PLANOS E ASSINAR";
  const abrir = () => void (modo === "renovar" && !renovacao ? abrirRenovarNoSite() : abrirAssinarNoSite());
  return (
    <div className="rounded-[22px] border px-5 py-6 text-center text-[#F4F1EA]" style={{ background: "#0b0b0d", borderColor: "rgba(255,90,69,.55)" }}>
      <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-[26px] font-black" style={{ background: "rgba(255,90,69,.14)", color: "#ff7d6b" }}>!</span>
      <p className="text-[21px] font-black mt-4 leading-tight">{titulo ?? "Assinatura inválida"}</p>
      <p className="text-[13.5px] mt-1.5 leading-snug" style={{ color: "#b9b3a6" }}>
        {texto ?? <>Sua assinatura não está ativa ou expirou.<br />Para usar a VANT você precisa de uma assinatura ativa.</>}
      </p>
      <div className="mt-5 space-y-2.5">
        {renovacao}
        <button type="button" onClick={abrir} className={btn("")}
          style={renovacao ? { background: "#121211", border: "1px solid #2a2823" } : { background: GOLD, color: "#1A1200" }}>
          <ExternalLink className="w-4 h-4" strokeWidth={2.6} /> {principal}
        </button>
        {onTentar && (
          <button type="button" onClick={onTentar} disabled={tentando} className={btn("disabled:opacity-60")} style={{ background: "#121211", border: "1px solid #2a2823" }}>
            <RefreshCw className={`w-4 h-4 ${tentando ? "animate-spin" : ""}`} /> {tentando ? "Verificando..." : "Já paguei, verificar acesso"}
          </button>
        )}
        <button type="button" onClick={() => void abrirLinkExterno(SUPORTE)} className={btn("")} style={{ background: "transparent", border: "1px solid #2a2823", color: "#b9b3a6" }}>
          Falar com o suporte
        </button>
        {onSair && (
          <button type="button" onClick={onSair} className={btn("")} style={{ background: "transparent", border: "1px solid rgba(255,90,69,.55)", color: "#ff7d6b" }}>
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        )}
      </div>
    </div>
  );
}

/** Modo "fora": aviso neutro, sem link nem preço, só suporte. */
export function AvisoAssinaturaLoja({ onFechar }: { onFechar?: () => void }) {
  if (assinaPelaApple()) return <TelaAssinarPelaApple onFechar={onFechar} />;
  if (assinaPeloSite()) return <TelaAssinarPeloSite />;
  return (
    <div className="rounded-[20px] border px-5 py-5 flex flex-col gap-2.5 text-left" style={{ background: "#0e0e10", borderColor: "rgba(245,184,0,.35)" }}>
      <span className="text-[11px] font-black tracking-[.14em]" style={{ color: GOLD }}>SUA CONTA</span>
      <p className="text-[17px] font-extrabold leading-snug">Pelo app não dá pra assinar.</p>
      <p className="text-[13.5px] leading-snug" style={{ color: "#b9b3a6" }}>
        Se você já assina a VANT, entra com a mesma conta que tudo libera aqui. Qualquer dúvida, o suporte te ajuda.
      </p>
      <div className="flex gap-2 mt-1">
        <button type="button" onClick={() => void abrirLinkExterno(SUPORTE)}
          className="h-11 px-4 rounded-[12px] text-[14px] font-black" style={{ background: GOLD, color: "#1A1200" }}>
          Falar com o suporte
        </button>
        {onFechar && (
          <button type="button" onClick={onFechar} className="h-11 px-4 rounded-[12px] text-[14px] font-bold" style={{ background: "#121211", border: "1px solid #26241f" }}>
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}

/** Ouve qualquer tentativa de abrir checkout no app da loja e mostra o aviso/tela. */
export function OuvinteAssinaturaLoja() {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ASSINATURA_LOJA, abrir);
    return () => window.removeEventListener(EVENTO_ASSINATURA_LOJA, abrir);
  }, []);
  if (!aberto) return null;
  if (assinaPelaApple()) return <TelaAssinarPelaApple telaCheia onFechar={() => setAberto(false)} />;
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setAberto(false)}>
      <div className="w-full max-w-sm text-[#F4F1EA]" onClick={(e) => e.stopPropagation()}>
        <AvisoAssinaturaLoja onFechar={() => setAberto(false)} />
      </div>
    </div>
  );
}

/** Tela/caixa de venda: no app da loja vira a tela "Assinar pelo site" (ou some). */
export function soComAssinatura<P extends object>(Componente: ComponentType<P>, semAssinatura: "aviso" | "nada" = "aviso") {
  function ComAssinatura(props: P) {
    if (podeMostrarAssinatura()) return <Componente {...props} />;
    return semAssinatura === "aviso" ? <div className="px-4 py-6 max-w-md mx-auto text-[#F4F1EA]"><AvisoAssinaturaLoja /></div> : null;
  }
  ComAssinatura.displayName = `soComAssinatura(${Componente.displayName ?? Componente.name ?? "Componente"})`;
  return ComAssinatura;
}
