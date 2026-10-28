/* Moldura da tela "Tô no mercado": voltar, título, conteúdo e rodapé fixo. */
import { useRef, useState, type FocusEvent, type ReactNode } from "react";

const DIGITA = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
import { ChevronLeft } from "lucide-react";

export function MercadoCasca({ titulo, sub, onVoltar, children, rodape }: {
  titulo: ReactNode; sub?: ReactNode; onVoltar: () => void; children: ReactNode; rodape?: ReactNode;
}) {
  // 26/10 (Rick): com o teclado aberto o rodapé fixo subia junto e cobria os ingredientes.
  // Enquanto digita num campo da lista, o rodapé para de flutuar (fica no fim da lista) e
  // o campo rola pro meio da tela.
  const conteudo = useRef<HTMLDivElement>(null);
  const [digitando, setDigitando] = useState(false);
  const aoFocar = (e: FocusEvent<HTMLDivElement>) => {
    if (!DIGITA(e.target)) return;
    setDigitando(true);
    const el = e.target;
    window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
  };
  const aoSair = () => window.setTimeout(() => {
    const a = document.activeElement;
    setDigitando(DIGITA(a) && !!conteudo.current?.contains(a));
  }, 60);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="min-h-[100dvh] text-[#F4F1EA] px-4 max-w-md mx-auto flex flex-col gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <div className="flex items-start gap-2">
          <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1 mt-0.5" style={{ color: "#7b766e" }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-extrabold tracking-tight leading-[1.1]">{titulo}</h1>
            {sub && <p className="text-[13px]" style={{ color: "#b9b3a6" }}>{sub}</p>}
          </div>
        </div>
        <div ref={conteudo} onFocus={aoFocar} onBlur={aoSair} className="flex flex-col gap-3">{children}</div>
        <div className="flex-grow" />
        {rodape && (
          <div className={`${digitando ? "" : "sticky bottom-0 "}-mx-4 px-4 pt-3 flex flex-col gap-2 bg-black`}
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
