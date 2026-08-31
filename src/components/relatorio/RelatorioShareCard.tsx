import { useEffect, useRef, useState } from "react";
import { Instagram, Loader2, X, Download, Copy, Check } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";
import { buildRecapCanvas, type RecapStats, type RecapTemplate } from "./recapCanvas";

// Ordem do carrossel: feed/WhatsApp primeiro, story depois
const ORDER: RecapTemplate[] = ["post", "story"];
const CAPTIONS: Record<RecapTemplate, string> = {
  post: "Feed · WhatsApp · status (4:5)",
  story: "Story do Instagram (9:16)",
};

const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));

/**
 * "Compartilhar resultado" do Relatório pra períodos de mais de um dia (semana, mês,
 * intervalo). Arte própria estilo recap: faturamento, barras dia a dia com o melhor dia
 * em dourado, e a grade de números. A arte diária continua sendo a do fim do DEFCON.
 */
export function RelatorioShareCard({ stats }: { stats: RecapStats }) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<Partial<Record<RecapTemplate, string>>>({});
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Assinatura dos dados: se mudar (trocou o filtro), regera as artes
  const sig = JSON.stringify([stats.titulo, stats.faturamento, stats.lucro, stats.dias.map((d) => d.valor), stats.vendas, stats.horasMin]);
  useEffect(() => { setPreviews({}); }, [sig]);

  useEffect(() => {
    if (!open || Object.keys(previews).length === ORDER.length) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Partial<Record<RecapTemplate, string>> = {};
      for (const t of ORDER) {
        const c = await buildRecapCanvas(t, stats);
        if (c) out[t] = c.toDataURL("image/png");
      }
      if (alive) { setPreviews(out); setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previews, sig]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const gerarBlob = async () => {
    const template = ORDER[index] ?? "post";
    const canvas = await buildRecapCanvas(template, stats);
    const blob = canvas ? await canvasToBlob(canvas) : null;
    if (!blob) throw new Error("Falha ao gerar imagem");
    return blob;
  };

  const baixar = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbis-recap.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    try {
      setBusy(true);
      const blob = await gerarBlob();
      const file = new File([blob], "orbis-recap.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meu resultado no Orbis",
          text: `${stats.titulo} • ${formatCurrency(stats.faturamento)} de faturamento`,
        });
      } else {
        baixar(blob);
        toast({ title: "Imagem baixada", description: "Abra o Instagram e poste no story ou no feed." });
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== "AbortError") toast({ title: "Erro ao compartilhar", description: e.message || "Tente de novo.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    try {
      setBusy(true);
      baixar(await gerarBlob());
      toast({ title: "Imagem salva", description: "Confira nas suas fotos / downloads." });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente de novo.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      setBusy(true);
      const blob = await gerarBlob();
      const clip = navigator as Navigator & { clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> } };
      if (clip.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await clip.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        toast({ title: "Imagem copiada", description: "Cole no WhatsApp, Instagram, onde quiser." });
      } else {
        baixar(blob);
      }
    } catch {
      toast({ title: "Não deu pra copiar", description: "Use Salvar e anexe manualmente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const igGradient = {
    backgroundImage: `linear-gradient(to right, ${BRAND_COLORS.INSTAGRAM_GRADIENT.from}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.via}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.to})`,
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={igGradient}
      >
        <Instagram className="w-4 h-4" />
        Compartilhar resultado
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-card border border-border p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Escolha a arte</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground active:scale-90" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando as artes...
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex overflow-x-auto snap-x snap-mandatory rounded-xl"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {ORDER.map((t) => (
              <div key={t} className="snap-center shrink-0 w-full h-80 flex items-center justify-center">
                {previews[t] && (
                  <img src={previews[t]} alt={`Arte ${t}`} className="max-h-80 max-w-[94%] object-contain rounded-lg border border-border" />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {ORDER.map((t, i) => (
              <span key={t} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40"}`} />
            ))}
          </div>
          <p className="text-center text-[11px] font-medium text-foreground -mt-1">{CAPTIONS[ORDER[index] ?? "post"]}</p>
          <p className="text-center text-[10px] text-muted-foreground -mt-2">← arraste pra escolher →</p>
        </>
      )}

      <button
        onClick={handleShare}
        disabled={busy || loading}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        style={igGradient}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
        {busy ? "Gerando..." : "Compartilhar"}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={handleSave} disabled={busy || loading} className="h-11 rounded-xl bg-muted/60 border border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
          <Download className="w-4 h-4" /> Salvar
        </button>
        <button onClick={handleCopy} disabled={busy || loading} className="h-11 rounded-xl bg-muted/60 border border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
