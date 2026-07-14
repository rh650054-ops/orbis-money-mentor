import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Loader2, Upload, Trash2, CheckCircle2, AlertTriangle, Sparkles, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

interface DiaImport {
  data: string;
  faturamento: number;
  dinheiro: number;
  pix: number;
  gorjeta: number;
  calote: number;
  custo: number;
  transporte: number;
  alimentacao: number;
  unidades_iniciais: number;
  unidades_nao_pagas: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  onImported?: () => void;
}

export default function ImportPdfDialog({ open, onOpenChange, userId, onImported }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"idle" | "loading" | "review">("idle");
  const [modo, setModo] = useState<"arquivo" | "texto">("arquivo");
  const [texto, setTexto] = useState("");
  const [dias, setDias] = useState<DiaImport[]>([]);
  const [resumo, setResumo] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setStep("idle"); setDias([]); setResumo(""); setTexto(""); setOverwrite(false); };

  const analyze = async (payload: Record<string, unknown>) => {
    setStep("loading");
    try {
      const { data, error } = await supabase.functions.invoke("import-financial-pdf", { body: payload });
      if (error) throw new Error(error.message || "Erro ao processar.");
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const lista = ((data as { dias?: DiaImport[] })?.dias || []) as DiaImport[];
      if (lista.length === 0) {
        toast({ title: "Nada encontrado", description: "A IA não achou dias com valores. Tente mandar de forma mais organizada.", variant: "destructive" });
        setStep("idle");
        return;
      }
      setResumo(String((data as { resumo?: string })?.resumo || ""));
      setDias(lista);
      setStep("review");
    } catch (e) {
      toast({ title: "Erro na importação", description: e instanceof Error ? e.message : "Tente de novo.", variant: "destructive" });
      setStep("idle");
    }
  };

  const handleFile = async (file: File) => {
    const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    if (isText) {
      const txt = await file.text();
      await analyze({ text: txt });
    } else {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error("Não consegui ler o arquivo."));
        r.readAsDataURL(file);
      });
      await analyze({ pdfBase64: b64, mimeType: file.type || "application/pdf" });
    }
  };

  const editar = (i: number, campo: keyof DiaImport, valor: string) => {
    setDias((prev) => prev.map((d, idx) => (idx === i ? { ...d, [campo]: campo === "data" ? valor : Number(valor.replace(",", ".")) || 0 } : d)));
  };
  const remover = (i: number) => setDias((prev) => prev.filter((_, idx) => idx !== i));

  const totalFaturamento = dias.reduce((s, d) => s + (Number(d.faturamento) || 0), 0);
  const semData = dias.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.data)).length;

  const salvar = async () => {
    setSaving(true);
    try {
      const rows = dias
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.data))
        .map((d) => ({
          user_id: userId,
          date: d.data,
          total_profit: Number(d.faturamento) || 0,
          cash_sales: Number(d.dinheiro) || 0,
          pix_sales: Number(d.pix) || 0,
          card_sales: 0,
          tip_sales: Number(d.gorjeta) || 0,
          total_debt: Number(d.calote) || 0,
          cost: Number(d.custo) || 0,
          transport_cost: Number(d.transporte) || 0,
          food_cost: Number(d.alimentacao) || 0,
          unpaid_units: Math.round(Number(d.unidades_nao_pagas) || 0),
          units_carried: Math.round(Number(d.unidades_iniciais) || 0),
          reinvestment: 0,
        }));
      if (rows.length === 0) { toast({ title: "Sem dias com data válida", description: "Preencha a data dos dias antes de salvar.", variant: "destructive" }); setSaving(false); return; }
      const { error } = await supabase
        .from("daily_sales")
        .upsert(rows as never, { onConflict: "user_id,date", ignoreDuplicates: !overwrite });
      if (error) throw error;
      toast({ title: "✓ Importado!", description: `${rows.length} dias adicionados ao seu histórico.` });
      onImported?.();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl p-4 sm:p-6 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar histórico</DialogTitle>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              <button onClick={() => setModo("arquivo")} className={`py-2 rounded-lg text-sm font-semibold transition-colors ${modo === "arquivo" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Arquivo (PDF/foto)</button>
              <button onClick={() => setModo("texto")} className={`py-2 rounded-lg text-sm font-semibold transition-colors ${modo === "texto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Texto (WhatsApp)</button>
            </div>

            {modo === "arquivo" ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Envie uma planilha, relatório ou foto das suas anotações. A IA lê os dias e você confere antes de salvar.
                </p>
                <button onClick={() => inputRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors">
                  <Upload className="w-7 h-7 text-primary" />
                  <span className="text-sm font-semibold">Escolher PDF, imagem ou .txt</span>
                  <span className="text-[11px] text-muted-foreground">até ~8MB · se for grande, importe por mês</span>
                </button>
                <input ref={inputRef} type="file" accept="application/pdf,image/*,text/plain,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <MessageCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  Cole aqui suas anotações (ex: exportadas do WhatsApp). Pode ser bagunçado — a IA entende. Ex: "12/07 fiz 300 no pix e 50 dinheiro, gastei 40 de mercadoria, 2 caloteiros".
                </p>
                <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole suas anotações aqui…" rows={7} className="text-sm" />
                <Button onClick={() => { if (texto.trim().length < 5) { toast({ title: "Cole um texto maior", variant: "destructive" }); return; } analyze({ text: texto }); }} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" /> Analisar com IA
                </Button>
              </>
            )}

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
              A IA pode errar algum número ou data — por isso você revisa tudo antes de confirmar.
            </p>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo com a IA…</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 pt-1">
            {resumo && (
              <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-foreground leading-relaxed">{resumo}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{dias.length} dias{semData > 0 ? ` · ${semData} sem data (preencha)` : ""}</span>
              <span className="text-sm font-bold text-primary">{formatCurrency(totalFaturamento)}</span>
            </div>

            <div className="max-h-[42vh] overflow-auto rounded-xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted-foreground border-b border-border/60">
                    <th className="text-left font-medium px-2 py-1.5">Data</th>
                    <th className="text-right font-medium px-1 py-1.5">Faturam.</th>
                    <th className="text-right font-medium px-1 py-1.5">Pix</th>
                    <th className="text-right font-medium px-1 py-1.5">Dinh.</th>
                    <th className="text-right font-medium px-1 py-1.5">Custo</th>
                    <th className="text-right font-medium px-1 py-1.5">Calote</th>
                    <th className="px-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d, i) => {
                    const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(d.data);
                    return (
                      <tr key={i} className={`border-b border-border/30 ${dataOk ? "" : "bg-destructive/5"}`}>
                        <td className="px-1 py-1"><Input type="date" value={d.data} onChange={(e) => editar(i, "data", e.target.value)} className="h-8 w-32 text-xs px-1" /></td>
                        <td className="px-1 py-1"><Input value={String(d.faturamento)} onChange={(e) => editar(i, "faturamento", e.target.value)} className="h-8 w-20 text-right text-xs px-1 font-semibold" /></td>
                        <td className="px-1 py-1"><Input value={String(d.pix)} onChange={(e) => editar(i, "pix", e.target.value)} className="h-8 w-16 text-right text-xs px-1" /></td>
                        <td className="px-1 py-1"><Input value={String(d.dinheiro)} onChange={(e) => editar(i, "dinheiro", e.target.value)} className="h-8 w-16 text-right text-xs px-1" /></td>
                        <td className="px-1 py-1"><Input value={String(d.custo)} onChange={(e) => editar(i, "custo", e.target.value)} className="h-8 w-16 text-right text-xs px-1" /></td>
                        <td className="px-1 py-1"><Input value={String(d.calote)} onChange={(e) => editar(i, "calote", e.target.value)} className="h-8 w-16 text-right text-xs px-1" /></td>
                        <td className="px-1 py-1 text-center"><button onClick={() => remover(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="accent-primary" />
              Sobrescrever dias que já existem (por padrão, mantém os existentes)
            </label>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button variant="outline" onClick={reset} className="w-full sm:flex-1">Voltar</Button>
              <Button onClick={salvar} disabled={saving} className="w-full sm:flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar e salvar</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
