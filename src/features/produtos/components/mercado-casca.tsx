/* Moldura da tela "Tô no mercado": voltar, título, conteúdo e rodapé fixo. */
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function MercadoCasca({ titulo, sub, onVoltar, children, rodape }: {
  titulo: ReactNode; sub?: ReactNode; onVoltar: () => void; children: ReactNode; rodape?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="min-h-[100dvh] text-[#F4F1EA] px-4 max-w-md mx-auto flex flex-col gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <div className="flex items-start gap-2">
          <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1 mt-0.5" style={{ color: "#7b766e" }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-[25px] font-black tracking-tight leading-[1.1]">{titulo}</h1>
            {sub && <p className="text-[13px]" style={{ color: "#b9b3a6" }}>{sub}</p>}
          </div>
        </div>
        {children}
        <div className="flex-grow" />
        {rodape && (
          <div className="sticky bottom-0 -mx-4 px-4 pt-3 flex flex-col gap-2 bg-black"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)", borderTop: "1px solid #1c1a16" }}>
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip de escolha (ingrediente, produto, "pra qual produto?"). */
export function Chip({ ativo, alerta, onClick, children }: {
  ativo?: boolean; alerta?: boolean; onClick: () => void; children: ReactNode;
}) {
  const borda = ativo ? "#F5B800" : alerta ? "rgba(255,122,107,.6)" : "#26241f";
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className="rounded-full px-3 py-1.5 text-[13px] font-extrabold"
      style={{ background: ativo ? "#1a1305" : "#121211", border: `1px solid ${borda}`, color: ativo ? "#F5B800" : "#F4F1EA" }}>
      {children}
    </button>
  );
}
