/* ============================================================
   X1 · PROVOCAÇÃO PRONTA + TORCIDA CERTEIRA (mock-x1-falta, ideias 3 e 4)
   Frases fixas (sem texto livre): cutuca sem virar briga. Máx. 3 por luta,
   uma a cada 2 min — a trava de verdade está no banco (x1_provocar).
   ============================================================ */
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { X1Avatar } from "./X1Avatar";
import { primeiroNome } from "./x1-lib";
import { FRASES, provocacoesRestantes, provocar, type Provocacao } from "./x1-lote5";

const GOLD = "#F5B800";
const MUTE = "#8a8378";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function Provocacoes({ lutaId, lista, podeMandar, onMandou }: { lutaId: string; lista: Provocacao[]; podeMandar: boolean; onMandou: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const resta = provocacoesRestantes(lista);
  const mandar = async (f: string) => {
    setEnviando(f);
    const erro = await provocar(lutaId, f);
    setEnviando(null);
    if (erro) { toast({ title: "Não foi", description: erro, variant: "destructive" }); return; }
    try { navigator.vibrate?.(30); } catch { /* sem vibração */ }
    onMandou();
  };
  if (!podeMandar && lista.length === 0) return null;
  return (
    <div className="rounded-[18px] border px-3.5 py-3 mt-3" style={{ background: "#0e0e10", borderColor: "#3a2f0c" }}>
      <p className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>
        <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.6} /> PROVOCAÇÃO{podeMandar ? ` · ${resta} DE 3` : ""}
      </p>
      {lista.slice(0, 4).map((p) => (
        <div key={p.id} className="flex items-center gap-2 mt-2">
          <X1Avatar url={p.avatar_url} nome={p.nome} size={26} cor={p.minha ? GOLD : "#F2465A"} />
          <span className="rounded-[12px] px-2.5 py-1.5 text-[12.5px] font-bold" style={{ background: p.minha ? "#1a1305" : "#2a0c11", color: "#e9e4d8" }}>
            {p.frase}
          </span>
          <span className="text-[10px] ml-auto shrink-0" style={{ color: MUTE }}>{p.minha ? "você" : primeiroNome(p.nome)} · {hora(p.criado_em)}</span>
        </div>
      ))}
      {podeMandar && resta > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {FRASES.map((f) => (
            <button key={f} type="button" disabled={!!enviando} onClick={() => mandar(f)}
              className="rounded-full px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-50 active:scale-95 transition-transform"
              style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              {f}
            </button>
          ))}
        </div>
      )}
      {podeMandar && <p className="text-[10.5px] mt-2" style={{ color: MUTE }}>Frases prontas, com a sua foto. Máx. 3 por luta: cutuca sem virar briga.</p>}
    </div>
  );
}

export function TorcidaCerteira({ acertos, total }: { acertos: number; total: number }) {
  return (
    <p className="text-[10.5px] text-center mt-1.5" style={{ color: MUTE }}>
      Quem torce e acerta ganha <b style={{ color: GOLD }}>+1 ponto</b> de patente.{total > 0 ? ` Seus palpites: ${acertos} de ${total} certos.` : ""}
    </p>
  );
}
