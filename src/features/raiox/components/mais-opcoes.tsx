/* "Mais opções": importing sales history from a PDF (kept from the old Análise tab). */
import { useState } from "react";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";
import { COR } from "@/components/financas/planejar/ui";

export function MaisOpcoes({ onImportar }: { onImportar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="min-h-11 inline-flex items-center gap-1 text-[14px] font-bold rounded-[10px] -ml-1 px-1 transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.sub }}>
        Mais opções <ChevronDown className="w-4 h-4 transition-transform duration-200" style={{ transform: aberto ? "rotate(180deg)" : "none" }} strokeWidth={2.4} />
      </button>
      {aberto && (
        <button type="button" onClick={onImportar}
          className="orbis-card-in w-full min-h-12 flex items-center gap-3 text-left text-[14px] font-semibold rounded-[12px] px-1 transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.texto }}>
          <Upload className="w-5 h-5 shrink-0" strokeWidth={2} style={{ color: COR.sub }} />
          <span className="flex-1">Importar histórico de vendas (PDF)</span>
          <ChevronRight className="w-4 h-4" style={{ color: "#5c5850" }} />
        </button>
      )}
    </div>
  );
}
