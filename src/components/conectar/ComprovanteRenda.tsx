/* ============================================================
   COMPROVANTE DE RENDA — card no Vant Pro (Lote 6). Um toque gera o PDF com
   o faturamento verificado pelo banco, mês a mês, pra alugar casa ou pedir
   crédito. Escolhe 3 ou 6 meses.
   ============================================================ */
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { baixarComprovantePDF, gerarComprovante } from "./comprovante-renda";

const GOLD = "#F5B800";
const MUTE = "#8a857c";

export function ComprovanteRenda() {
  const [meses, setMeses] = useState<3 | 6>(3);
  const [gerando, setGerando] = useState(false);
  const gerar = async () => {
    setGerando(true);
    try {
      const c = await gerarComprovante(meses);
      baixarComprovantePDF(c);
      toast({ title: "Comprovante baixado", description: `Código de verificação ${c.codigo}.` });
    } catch (e) {
      avisar.silencioso("comprovante de renda", e);
      toast({ title: "Não deu pra gerar agora", description: "Tenta de novo em instantes.", variant: "destructive" });
    } finally { setGerando(false); }
  };
  return (
    <div className="rounded-[22px] px-4 py-4" style={{ background: "linear-gradient(180deg,#111114,#0b0b0d)", border: "1px solid #1f1e22" }}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.1)", border: "1px solid rgba(245,184,0,.35)" }}>
          <FileText className="w-5 h-5" style={{ color: GOLD }} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-black">Comprovante de renda</p>
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTE }}>PDF com o que caiu no seu banco, mês a mês. Serve pra alugar casa, abrir crediário ou pedir empréstimo.</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {([3, 6] as const).map((n) => (
          <button key={n} type="button" onClick={() => setMeses(n)} className="flex-1 h-9 rounded-[11px] text-[12px] font-black"
            style={meses === n ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16161a", border: "1px solid #2a2a2e", color: MUTE }}>
            últimos {n} meses
          </button>
        ))}
      </div>
      <button type="button" onClick={gerar} disabled={gerando}
        className="w-full h-12 rounded-[14px] mt-2.5 inline-flex items-center justify-center gap-2 text-[14px] font-black disabled:opacity-60"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
        {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} BAIXAR COMPROVANTE
      </button>
    </div>
  );
}
