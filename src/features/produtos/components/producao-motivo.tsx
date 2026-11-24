/* Asks WHY (recipe changed to use less, a correction, an undo). 5 to 300 letters, as the database requires. */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { BotaoOuro } from "./quiz-casca";
import { ACIMA_DA_CASCA } from "./mercado-casca";

export function ProducaoMotivo({ aberto, titulo, explicacao, botao, minimo = 5, enviando, onEnviar, onFechar }: {
  aberto: boolean; titulo: string; explicacao: string; botao: string; minimo?: number; enviando?: boolean;
  onEnviar: (motivo: string) => void; onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const ok = texto.trim().length >= minimo && texto.length <= 300;
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent overlayClassName={ACIMA_DA_CASCA} className={`bg-[#0b0b0c] text-[#F4F1EA] border-[#26241f] max-w-sm ${ACIMA_DA_CASCA}`}>
        <DialogHeader><DialogTitle className="text-[19px] font-black">{titulo}</DialogTitle></DialogHeader>
        <p className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>{explicacao}</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 300))} rows={3} aria-label="Motivo"
          placeholder="Ex.: a receita nova rende mais" className="w-full rounded-[12px] bg-[#151515] border border-[#262626] p-3 text-[14px] outline-none" />
        <BotaoOuro disabled={!ok || enviando} onClick={() => onEnviar(texto.trim())}>{enviando ? "ENVIANDO…" : botao}</BotaoOuro>
      </DialogContent>
    </Dialog>
  );
}
