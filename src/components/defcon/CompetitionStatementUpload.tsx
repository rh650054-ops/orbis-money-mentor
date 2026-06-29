import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { Upload, CheckCircle2, FileText, Loader2 } from "lucide-react";

const BUCKET = "bank-statements";

interface ActiveComp {
  id: string;
  name: string;
}

// Aparece no fim do DEFCON SÓ pra quem participa de competição ativa.
// Sobe o extrato bancário do dia (imagem/PDF) num bucket PRIVADO; o admin analisa
// e o valor entra no ranking. O extrato de ontem é apagado ao subir o de hoje.
export function CompetitionStatementUpload({ userId }: { userId: string }) {
  const [comps, setComps] = useState<ActiveComp[]>([]);
  const [sentToday, setSentToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: parts } = await supabase
        .from("competition_participants" as any)
        .select("competition_id")
        .eq("user_id", userId);
      const ids = Array.from(new Set(((parts as any[]) || []).map((p) => p.competition_id))).filter(Boolean);
      if (ids.length === 0) {
        if (alive) {
          setComps([]);
          setLoading(false);
        }
        return;
      }
      const { data: cs } = await supabase
        .from("competitions" as any)
        .select("id, name, status")
        .in("id", ids)
        .eq("status", "active");
      const active = ((cs as any[]) || []).map((c) => ({ id: c.id, name: c.name }));
      const today = getBrazilDate();
      let sent = false;
      if (active.length) {
        const { data: st } = await supabase
          .from("bank_statements" as any)
          .select("id")
          .eq("user_id", userId)
          .eq("context_type", "competition")
          .eq("statement_date", today)
          .limit(1);
        sent = ((st as any[]) || []).length > 0;
      }
      if (alive) {
        setComps(active);
        setSentToday(sent);
        setLoading(false);
      }
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || comps.length === 0) return;
    const okType = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      toast({ title: "Envie uma imagem ou PDF do extrato", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 10MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const today = getBrazilDate();
      // 1) Apaga o extrato anterior (o de ontem some) — arquivos + linhas.
      const { data: prev } = await supabase
        .from("bank_statements" as any)
        .select("id, file_path")
        .eq("user_id", userId)
        .eq("context_type", "competition");
      const prevRows = (prev as any[]) || [];
      const oldPaths = Array.from(new Set(prevRows.map((r) => r.file_path).filter(Boolean)));
      if (oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths);
      if (prevRows.length) {
        await supabase.from("bank_statements" as any).delete().eq("user_id", userId).eq("context_type", "competition");
      }
      // 2) Sobe o novo arquivo (pasta do próprio usuário = exigência do RLS).
      const ext = (file.name.split(".").pop() || "dat").toLowerCase().replace(/[^a-z0-9]/g, "") || "dat";
      const path = `${userId}/competitions/${today}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // 3) Uma linha por competição ativa (mesmo arquivo serve a todas).
      const rows = comps.map((c) => ({
        user_id: userId,
        context_type: "competition",
        competition_id: c.id,
        statement_date: today,
        file_path: path,
        status: "pending",
      }));
      const { error: insErr } = await supabase.from("bank_statements" as any).insert(rows);
      if (insErr) throw insErr;
      setSentToday(true);
      toast({ title: "Extrato enviado! ✅", description: "O admin vai analisar e seu valor entra no ranking." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar extrato", description: err?.message || "Tente de novo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading || comps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-bold text-amber-400">Extrato do dia — competição</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Você está em {comps.length} competiç{comps.length === 1 ? "ão" : "ões"}. Suba o extrato do banco de hoje pra
        valer no ranking (o admin analisa). O de ontem é substituído.
      </p>
      {sentToday ? (
        <div className="flex items-center gap-2 text-sm text-green-400 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Extrato de hoje enviado — aguardando análise.
          <button onClick={pick} disabled={uploading} className="ml-auto text-xs text-amber-400 underline disabled:opacity-60">
            Reenviar
          </button>
        </div>
      ) : (
        <button
          onClick={pick}
          disabled={uploading}
          className="w-full h-11 rounded-xl bg-amber-500/90 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Subir extrato (imagem ou PDF)
            </>
          )}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
    </div>
  );
}
