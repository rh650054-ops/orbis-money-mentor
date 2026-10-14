/* App da loja no modo "fora" (cobranca-loja.ts): no lugar de preço e botão de
   assinar, um aviso neutro — sem link nem preço, só suporte. */
import { useEffect, useState, type ComponentType } from "react";
import { EVENTO_ASSINATURA_LOJA, podeMostrarAssinatura } from "@/shared/lib/cobranca-loja";

const SUPORTE = "https://wa.me/5511915054830?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20a%20minha%20conta%20da%20Vant";

export function AvisoAssinaturaLoja({ onFechar }: { onFechar?: () => void }) {
  return (
    <div className="rounded-[20px] border px-5 py-5 flex flex-col gap-2.5 text-left" style={{ background: "#0e0e10", borderColor: "rgba(245,184,0,.35)" }}>
      <span className="text-[11px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>SUA CONTA</span>
      <p className="text-[17px] font-extrabold leading-snug">Pelo app não dá pra assinar.</p>
      <p className="text-[13.5px] leading-snug" style={{ color: "#b9b3a6" }}>
        Se você já assina a VANT, entra com a mesma conta que tudo libera aqui. Qualquer dúvida, o suporte te ajuda.
      </p>
      <div className="flex gap-2 mt-1">
        <button type="button" onClick={() => window.open(SUPORTE, "_blank")}
          className="h-11 px-4 rounded-[12px] text-[14px] font-black" style={{ background: "#F5B800", color: "#1A1200" }}>
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

/** Ouve qualquer tentativa de abrir checkout no app da loja e mostra o aviso. */
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

/** Tela/caixa de venda: no app da loja (modo "fora") vira o aviso (ou some). */
export function soComAssinatura<P extends object>(Componente: ComponentType<P>, semAssinatura: "aviso" | "nada" = "aviso") {
  function ComAssinatura(props: P) {
    if (podeMostrarAssinatura()) return <Componente {...props} />;
    return semAssinatura === "aviso" ? <div className="px-4 py-6 max-w-md mx-auto text-[#F4F1EA]"><AvisoAssinaturaLoja /></div> : null;
  }
  ComAssinatura.displayName = `soComAssinatura(${Componente.displayName ?? Componente.name ?? "Componente"})`;
  return ComAssinatura;
}
