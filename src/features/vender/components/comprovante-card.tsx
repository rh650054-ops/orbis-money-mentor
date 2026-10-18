/* Level 5 tool — income proof PDF from what landed in the bank, month by month. */
import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { COR, Secao } from "@/shared/components/vant-ui";
import { Segmentado } from "@/shared/components/vant-status";
import { baixarComprovantePDF, gerarComprovante } from "@/components/conectar/comprovante-renda";

export function ComprovanteCard() {
  const [meses, setMeses] = useState<"3" | "6">("3");
  const [gerando, setGerando] = useState(false);
  const baixar = async () => {
    setGerando(true);
    try {
      const c = await gerarComprovante(Number(meses) as 3 | 6);
      baixarComprovantePDF(c);
      toast({ title: "Comprovante baixado", description: `Código de verificação ${c.codigo}.` });
    } catch (e) {
      avisar.silencioso("comprovante de renda", e);
      toast({ title: "Não deu pra gerar agora", description: "Tenta de novo em instantes.", variant: "destructive" });
    } finally { setGerando(false); }
  };
  return (
    <Secao titulo="COMPROVANTE DE RENDA" id="sec-comprovante">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 shrink-0 mt-0.5" style={{ color: COR.ouro }} />
        <p className="text-[12.5px] leading-snug" style={{ color: COR.suave }}>
          PDF do que caiu no banco. Serve pra aluguel e crédito.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-3 items-center">
        <Segmentado rotulo="Período: últimos meses" valor={meses} onEscolher={setMeses}
          opcoes={[{ valor: "3", texto: "3 meses" }, { valor: "6", texto: "6 meses" }]} />
        <button type="button" onClick={baixar} disabled={gerando} aria-label="Baixar comprovante"
          className="h-[38px] px-3.5 rounded-[11px] inline-flex items-center gap-1.5 text-[12.5px] font-black transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
          style={{ background: COR.ouro, color: "#1A1200" }}>
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar
        </button>
      </div>
    </Secao>
  );
}
