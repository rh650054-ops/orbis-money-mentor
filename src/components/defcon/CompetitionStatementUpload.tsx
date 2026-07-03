import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { getExtratoDia } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { useMeuExtrato } from "@/hooks/useMeuExtrato";
import { CheckCircle2, FileText, Loader2, Smartphone, CreditCard, Trash2 } from "lucide-react";

// Aparece no fim do DEFCON SÓ pra quem participa de competição ativa.
// A IA (verificar-extrato) lê o extrato do dia, audita (só card+pix que ENTROU)
// e salva em extrato_uploads — que alimenta o ranking VERIFICADO da competição.
// Dá pra reenviar (substitui) se cair mais Pix depois.
export function CompetitionStatementUpload({ userId }: { userId: string }) {
  const [inComp, setInComp] = useState(false);
  const [inX1, setInX1] = useState(false); // tem X1 marcado pro dia do extrato
  const [loading, setLoading] = useState(true);
  const dia = getExtratoDia();
  const diaLabel = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const { pix, cartao, totalDia, upload, remove } = useMeuExtrato(userId, dia);
  const [busy, setBusy] = useState<null | "pix" | "cartao">(null);
  const [deleting, setDeleting] = useState<null | "pix" | "cartao">(null);
  const pixRef = useRef<HTMLInputElement>(null);
  const cartaoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Roda as duas checagens em paralelo: competição ativa E X1 marcado pro dia.
      const [{ data: parts }, { data: x1s }] = await Promise.all([
        supabase.from("competition_participants" as any).select("competition_id").eq("user_id", userId),
        supabase
          .from("x1_challenges" as any)
          .select("id")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .eq("scheduled_date", dia)
          .in("status", ["accepted", "active"]),
      ]);

      // Competição: participa de alguma que esteja ativa?
      let comp = false;
      const ids = Array.from(new Set(((parts as any[]) || []).map((p) => p.competition_id))).filter(Boolean);
      if (ids.length > 0) {
        const { data: cs } = await supabase.from("competitions" as any).select("id").in("id", ids).eq("status", "active");
        comp = ((cs as any[]) || []).length > 0;
      }

      if (!alive) return;
      setInComp(comp);
      setInX1(((x1s as any[]) || []).length > 0);
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, dia]);

  const onFile = async (tipo: "pix" | "cartao", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(tipo);
    const r = await upload(tipo, file);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: r.erro ? "Extrato não aceito" : "Não consegui ler esse extrato",
        description: r.erro ?? "Tenta de novo ou manda uma foto mais nítida.",
        variant: "destructive",
      });
      return;
    }
    const susp = r.suspeitas?.length ?? 0;
    if (susp > 0 || r.acimaDoDefcon) {
      toast({
        title: "Extrato conferido — com avisos",
        description: `${susp > 0 ? `${susp} venda(s) suspeita(s) ignorada(s). ` : ""}${r.acimaDoDefcon ? "Passou do total do DEFCON — marcado pra revisão." : ""}`.trim(),
      });
    }
  };

  const onDelete = async (tipo: "pix" | "cartao") => {
    if (!window.confirm("Excluir esse extrato? Você pode enviar de novo depois.")) return;
    setDeleting(tipo);
    const { ok } = await remove(tipo);
    setDeleting(null);
    if (!ok) toast({ title: "Não consegui excluir agora", variant: "destructive" });
  };

  // Agora o extrato vale pro ranking de TODO mundo, então o bloco aparece pra todos
  // no fim do DEFCON (não só quem está em competição/X1).
  if (loading) return null;

  const selo = inX1 && inComp ? "vale p/ competição + X1" : inX1 ? "vale pro X1" : inComp ? "vale p/ competição" : null;

  const slotBtn = (
    tipo: "pix" | "cartao",
    label: string,
    Icon: typeof Smartphone,
    slot: { total_verificado: number } | null,
    ref: React.RefObject<HTMLInputElement>,
  ) => (
    <button
      onClick={() => ref.current?.click()}
      disabled={busy !== null}
      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold flex flex-col items-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-60 ${
        slot ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-amber-500/90 text-black"
      }`}
    >
      {busy === tipo ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : slot ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span>{slot ? formatCurrency(slot.total_verificado) : label}</span>
      {slot && <span className="text-[10px] font-medium opacity-70">tocar p/ reenviar</span>}
    </button>
  );

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-amber-400">Extrato do dia {diaLabel}</p>
        </div>
        {selo && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/40 rounded-full px-2 py-0.5 whitespace-nowrap">
            {selo}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Só o que a IA confere no extrato (<b className="text-foreground">Pix + cartão</b>) conta no ranking. Envie até as{" "}
        <b className="text-foreground">9h de amanhã</b> · dá pra reenviar.
      </p>
      <div className="flex gap-2">
        {slotBtn("pix", "Extrato Pix", Smartphone, pix, pixRef)}
        {slotBtn("cartao", "Extrato Cartão", CreditCard, cartao, cartaoRef)}
      </div>
      {(pix || cartao) && (
        <div className="flex gap-2">
          {pix && (
            <button onClick={() => onDelete("pix")} disabled={deleting !== null} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-destructive bg-destructive/10 disabled:opacity-60">
              {deleting === "pix" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Excluir Pix
            </button>
          )}
          {cartao && (
            <button onClick={() => onDelete("cartao")} disabled={deleting !== null} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-destructive bg-destructive/10 disabled:opacity-60">
              {deleting === "cartao" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Excluir Cartão
            </button>
          )}
        </div>
      )}
      {totalDia > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Verificado hoje</span>
          <span className="text-lg font-black text-emerald-400">{formatCurrency(totalDia)}</span>
        </div>
      )}
      <input ref={pixRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile("pix", e)} />
      <input ref={cartaoRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile("cartao", e)} />
    </div>
  );
}
