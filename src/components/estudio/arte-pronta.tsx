/* Arte pronta: mostra o PNG final e salva NO TOQUE do botão (o iPhone só abre
   "Salvar imagem" logo depois de um toque). Segurar o dedo na imagem também salva. */
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { entregarArquivo } from "./exportar-arte";

export function ArtePronta({ arquivo, onFechar, onSalvou, onErro }: {
  arquivo: File;
  onFechar: () => void;
  onSalvou: (como: "compartilhado" | "baixado") => void;
  onErro: (e: unknown) => void;
}) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const como = await entregarArquivo(arquivo);
      if (como !== "cancelado") onSalvou(como);
    } catch (e) {
      onErro(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-3 bg-black/85 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-white">Sua arte tá pronta</p>
          <button onClick={onFechar} aria-label="Fechar" className="p-1 text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <img src={url} alt="Arte final com o QR Pix" className="w-full max-h-[60vh] object-contain rounded-xl border border-white/10" />
        <Button onClick={salvar} disabled={salvando} className="w-full h-12 bg-gradient-primary text-base font-bold">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Salvar na galeria
        </Button>
        <p className="text-xs text-center text-white/60">
          Não abriu? Segura o dedo na imagem e toca em "Salvar na Fotos".
        </p>
      </div>
    </div>
  );
}
