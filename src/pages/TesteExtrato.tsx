import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Check, X } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { supabase } from "@/integrations/supabase/client";

interface AuditResult {
  ok: boolean;
  motor?: string;
  vendas: { descricao: string; valor: number }[];
  suspeitas?: { descricao: string; valor: number; motivo?: string }[];
  total_vendas: number;
  total_ignorado: number;
  qtd_vendas: number;
}

// Tela ESCONDIDA (só admin) pra testar a leitura do extrato pela IA.
// Não salva nada e NÃO conta no ranking — é só conferência.
export default function TesteExtrato() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");
    setLoading(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ""));
        r.onerror = () => reject(new Error("read_error"));
        r.readAsDataURL(file);
      });
      const { data, error: fnErr } = await supabase.functions.invoke("verificar-extrato", {
        body: { file: b64, mime: file.type || "application/pdf" },
      });
      const res = data as (AuditResult & { error?: string }) | null;
      if (fnErr || !res?.ok) {
        let detail = res?.error || fnErr?.message || "Falha ao ler o extrato";
        // supabase-js poe o corpo do erro (nosso JSON {error}) em fnErr.context (Response)
        try {
          const ctx = (fnErr as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === "function") {
            const bodyErr = await ctx.json();
            if (bodyErr?.error) detail = String(bodyErr.error);
            if (bodyErr?.raw) detail += ` · ${String(bodyErr.raw).slice(0, 120)}`;
          }
        } catch { /* noop */ }
        setError(detail);
        return;
      }
      setResult(res);
    } catch (err) {
      console.error(err);
      setError("Erro ao processar o arquivo");
    } finally {
      setLoading(false);
      if (e.target) e.target.value = "";
    }
  };

  if (!isAdmin) {
    return <div className="p-10 text-center text-muted-foreground">Acesso restrito.</div>;
  }

  return (
    <div className="space-y-5 pb-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teste · Leitura de extrato</h1>
          <p className="text-sm text-muted-foreground">Só admin · não salva e não conta no ranking</p>
        </div>
      </div>

      <Card className="border-dashed border-primary/30">
        <CardContent className="p-6 text-center space-y-3">
          <Upload className="w-10 h-10 mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Sobe um print ou PDF de extrato (pix ou cartão).</p>
          <label className="inline-flex">
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={loading} />
            <span className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading ? "Lendo o extrato..." : "Escolher arquivo"}
            </span>
          </label>
          {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <X className="w-4 h-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                <p className="font-bold">{result.qtd_vendas} vendas encontradas</p>
              </div>
              {result.motor && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    result.motor === "claude"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {result.motor === "claude" ? "✓ Lido pelo Claude" : "Lido pelo Gemini"}
                </span>
              )}
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {result.vendas.map((v, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate pr-2">{v.descricao || "Venda"}</span>
                  <span className="text-primary font-semibold whitespace-nowrap">+{fmt(v.valor)}</span>
                </div>
              ))}
            </div>
            {result.suspeitas && result.suspeitas.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-amber-500/30">
                <p className="text-xs font-bold text-amber-500">⚠ {result.suspeitas.length} suspeita(s) — NÃO contam (fraude)</p>
                {result.suspeitas.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-amber-500/80 truncate pr-2">{s.descricao}{s.motivo ? ` · ${s.motivo}` : ""}</span>
                    <span className="text-amber-500/80 font-semibold whitespace-nowrap line-through">{fmt(s.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Ignorado (despesas / compras)</span>
              <span className="text-muted-foreground">{fmt(result.total_ignorado)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold">Total verificado</span>
              <span className="text-2xl font-black text-primary">{fmt(result.total_vendas)}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-1">
              Teste — não salva nada nem conta no ranking.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
