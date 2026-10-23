/* "Reiniciar o dia" apaga as vendas de hoje (caso Adriel, 23/10/2026: perdeu R$ 722 da manhã
   achando que só recomeçava o cronômetro). Antes de apagar: mostra quanto ele perde e pede
   pra digitar ZERAR. Decisão do Rick: continua apagando tudo, só com essa confirmação. */
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";

const PALAVRA = "ZERAR";

export function ConfirmarZerarDia({ total, onConfirmar, onCancelar }: {
  total: number; onConfirmar: () => Promise<void>; onCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [zerando, setZerando] = useState(false);
  const ok = texto.trim().toUpperCase() === PALAVRA;
  const zerar = async () => {
    if (!ok || zerando) return;
    setZerando(true);
    try { await onConfirmar(); } finally { setZerando(false); }
  };
  return (
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Reiniciar o dia">
      <div className="w-full max-w-sm rounded-[22px] border p-5 text-center" style={{ background: "#0e0e10", borderColor: "rgba(229,115,127,.45)" }}>
        <RotateCcw className="w-7 h-7 mx-auto" style={{ color: "#e5737f" }} />
        <p className="text-[19px] font-black mt-2 leading-tight text-foreground">
          {total > 0 ? <>Você vai perder {formatCurrency(total)} de vendas de hoje</> : "Reiniciar o dia do zero"}
        </p>
        <p className="text-[12.5px] mt-1.5 leading-snug text-muted-foreground">
          Apaga as vendas, os blocos e o total de hoje, e o dia sai da constância. Não tem volta.
          Só quer continuar vendendo? Toque em <b className="text-foreground">Cancelar</b> e use "Voltar (+1h)".
        </p>
        <label className="block text-left text-[11px] font-bold tracking-[.12em] mt-4 text-muted-foreground" htmlFor="zerar-dia">
          DIGITE {PALAVRA} PRA CONFIRMAR
        </label>
        <input id="zerar-dia" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoCapitalize="characters"
          className="mt-1.5 w-full h-12 rounded-[12px] px-3 text-center text-[16px] font-black tracking-[.2em] bg-black border border-border text-foreground"
          placeholder={PALAVRA} />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={onCancelar} disabled={zerando} className="h-11 rounded-[12px] text-[13.5px] font-bold border border-border text-foreground">Cancelar</button>
          <button type="button" onClick={() => void zerar()} disabled={!ok || zerando}
            className="h-11 rounded-[12px] text-[13.5px] font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: "#e5737f", color: "#1A0806" }}>
            {zerando && <Loader2 className="w-4 h-4 animate-spin" />} Apagar o dia
          </button>
        </div>
      </div>
    </div>
  );
}
