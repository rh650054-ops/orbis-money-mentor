/* Moldura de cada pergunta do quiz: barra de progresso, título, conteúdo e o botão. */
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export const OURO = "linear-gradient(180deg, #FFF1B3 0%, #FFC800 55%, #D9A800 100%)";

export function BotaoOuro({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full h-[54px] rounded-2xl text-[15px] font-black tracking-wide disabled:opacity-40 active:scale-[.99] transition"
      style={{ background: OURO, color: "#1A1200" }}>
      {children}
    </button>
  );
}

export function LinkCinza({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-center text-[13px] font-extrabold underline py-1" style={{ color: "#b9b3a6" }}>
      {children}
    </button>
  );
}

export function QuizCasca({ passo, total, titulo, sub, onVoltar, children, rodape }: {
  passo: number; total: number; titulo: ReactNode; sub?: ReactNode;
  onVoltar: () => void; children: ReactNode; rodape: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] px-4 pt-safe pb-safe max-w-md mx-auto flex flex-col gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1" style={{ color: "#7b766e" }}>
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 flex gap-[5px]">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="flex-1 h-1 rounded-full" style={{ background: i < passo ? "#F5B800" : "#24221e" }} />
          ))}
        </div>
        <span className="text-[11px] font-extrabold" style={{ color: "#7b766e" }}>{passo} de {total}</span>
      </div>
      <div className="flex flex-col gap-1.5 pt-2.5">
        <h1 className="text-[25px] font-black tracking-tight leading-[1.1]">{titulo}</h1>
        {sub && <p className="text-[13px]" style={{ color: "#b9b3a6" }}>{sub}</p>}
      </div>
      {children}
      <div className="flex-grow" />
      <div className="flex flex-col gap-2">{rodape}</div>
    </div>
    </div>
  );
}

/** Card de destaque dourado: "Cada rolo te custa R$ 1,40". */
export function ResultadoOuro({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-[18px] px-4 py-3.5 flex justify-between items-center"
      style={{ background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: "1px solid rgba(245,184,0,.38)" }}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-extrabold" style={{ color: "#b9b3a6" }}>{rotulo}</span>
        {detalhe && <span className="text-[10.5px] font-bold" style={{ color: "#7b766e" }}>{detalhe}</span>}
      </div>
      <span className="text-[26px] font-black" style={{ color: "#F5B800" }}>{valor}</span>
    </div>
  );
}
