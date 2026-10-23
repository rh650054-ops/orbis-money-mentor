/* App da loja (cobranca-loja.ts):
 *  - "link" (modelo Néctar, padrão): sem preço nem checkout no app. Um cartão/tela com
 *    "Assinar" que abre o site da VANT no navegador, "Tentar novamente" e "Sair da conta".
 *  - "fora" (reserva): aviso neutro, só suporte. */
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { EVENTO_ASSINATURA_LOJA, assinaPeloSite, podeMostrarAssinatura } from "@/shared/lib/cobranca-loja";
import { abrirLinkExterno } from "@/shared/lib/link-externo";
import { abrirAssinarNoSite } from "@/shared/lib/assinar-no-site";

const SUPORTE = "https://wa.me/5511915054830?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20minha%20conta%20da%20Vant";
const GOLD = "#F5B800";

const btn = (extra: string) => `w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black ${extra}`;

/** Néctar-style block: "Assinatura inválida" + Assinar (site) · Tentar novamente · Sair. */
export function TelaAssinarPeloSite({ titulo, texto, onTentar, tentando, onSair, renovacao }: {
  titulo?: string; texto?: ReactNode; onTentar?: () => void; tentando?: boolean; onSair?: () => void;
  /** Pix da renovação em aberto: vira o botão principal; "Assinar" vira "Trocar de plano" */
  renovacao?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border px-5 py-6 text-center text-[#F4F1EA]" style={{ background: "#0b0b0d", borderColor: "rgba(255,90,69,.55)" }}>
      <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-[26px] font-black" style={{ background: "rgba(255,90,69,.14)", color: "#ff7d6b" }}>!</span>
      <p className="text-[21px] font-black mt-4 leading-tight">{titulo ?? "Assinatura inválida"}</p>
      <p className="text-[13.5px] mt-1.5 leading-snug" style={{ color: "#b9b3a6" }}>
        {texto ?? <>Sua assinatura não está ativa ou expirou.<br />Para usar a VANT você precisa de uma assinatura ativa.</>}
      </p>
      <div className="mt-5 space-y-2.5">
        {renovacao}
        <button type="button" onClick={() => void abrirAssinarNoSite()} className={btn("")}
          style={renovacao ? { background: "#121211", border: "1px solid #2a2823" } : { background: GOLD, color: "#1A1200" }}>
          <ExternalLink className="w-4 h-4" strokeWidth={2.6} /> {renovacao ? "Trocar de plano" : "Assinar"}
        </button>
        {onTentar && (
          <button type="button" onClick={onTentar} disabled={tentando} className={btn("disabled:opacity-60")} style={{ background: "#121211", border: "1px solid #2a2823" }}>
            <RefreshCw className={`w-4 h-4 ${tentando ? "animate-spin" : ""}`} /> {tentando ? "Verificando..." : "Tentar novamente"}
          </button>
        )}
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
