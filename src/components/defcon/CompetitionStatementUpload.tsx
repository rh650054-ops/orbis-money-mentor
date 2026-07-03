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
  // O que o vendedor REALMENTE usou no DEFCON do dia (R$ em pix e cartão):
  // só pedimos o extrato dos métodos usados — dia 100% Pix não pede maquininha.
  const [metodos, setMetodos] = useState<{ pix: number; cartao: number } | null>(null);
  const [forceShow, setForceShow] = useState<{ pix: boolean; cartao: boolean }>({ pix: false, cartao: false });
  const dia = getExtratoDia();
  const diaLabel = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const { pix, cartao, totalDia, upload, remove } = useMeuExtrato(userId, dia);
  const [busy, setBusy] = useState<null | "pix" | "cartao">(null);
  const [deleting, setDeleting] = useState<null | "pix" | "cartao">(null);
  // Últimos valores que NÃO contaram (com o motivo exato) — mostrado no card.
  const [avisos, setAvisos] = useState<{ valor?: number; motivo?: string; descricao?: string }[]>([]);
  const pixRef = useRef<HTMLInputElement>(null);
  const cartaoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Checagens em paralelo: competição ativa, X1 marcado pro dia e os métodos
      // que ele usou no DEFCON (pra pedir só o extrato que importa).
      const [{ data: parts }, { data: x1s }, { data: ds }] = await Promise.all([
        supabase.from("competition_participants" as any).select("competition_id").eq("user_id", userId),
        supabase
          .from("x1_challenges" as any)
          .select("id")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .eq("scheduled_date", dia)
          .in("status", ["accepted", "active"]),
        supabase.from("daily_sales").select("pix_sales, card_sales").eq("user_id", userId).eq("date", dia),
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
      const rows = (ds as any[]) || [];
      setMetodos({
        pix: rows.reduce((s, r) => s + (Number(r.pix_sales) || 0), 0),
        cartao: rows.reduce((s, r) => s + (Number(r.card_sales) || 0), 0),
      });
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
    setAvisos([]);
    const r = await upload(tipo, file);
    setBusy(null);
    if (!r.ok) {
      // Rejeição total: a IA já manda o motivo EXATO na dica (dia errado, doc errado, etc.).
      toast({
        title: r.erro ? "Extrato não aceito" : "Não consegui ler esse extrato",
        description: r.erro ?? "Tenta de novo ou manda uma foto mais nítida.",
        variant: "destructive",
      });
      return;
    }
    const susp = r.suspeitas ?? [];
    setAvisos(susp);
    if (susp.length > 0 || r.acimaDoDefcon) {
      toast({
        title: susp.length > 0 ? `${susp.length} valor(es) não contaram` : "Extrato conferido — com aviso",
        description: r.acimaDoDefcon
          ? "Passou do total do DEFCON — marcado pra revisão. Veja o porquê no card."
          : "Veja embaixo o motivo exato de cada um.",
      });
    }
  };

  const onDelete = async (tipo: "pix" | "cartao") => {
    if (!window.confirm("Excluir esse extrato? Você pode enviar de novo depois.")) return;
    setDeleting(tipo);
    const { ok } = await remove(tipo);
    setDeleting(null);
    if (ok) setAvisos([]);
    else toast({ title: "Não consegui excluir agora", variant: "destructive" });
  };

  // Agora o extrato vale pro ranking de TODO mundo, então o bloco aparece pra todos
  // no fim do DEFCON (não só quem está em competição/X1).
  if (loading) return null;

  const contexto = inComp && inX1 ? "competição + X1" : inX1 ? "seu X1" : inComp ? "competição" : "o ranking";

  // Pede SÓ o extrato dos métodos usados no DEFCON. Regras:
  // - já enviou → slot continua visível (pra reenviar/ver o valor)
  // - usou o método no DEFCON → visível
  // - não usou nenhum dos dois → mostra só o Pix (caso mais comum)
  // - dá pra forçar o slot escondido pelo link "recebi fora do DEFCON"
  const nadaNosDois = !!metodos && metodos.pix <= 0 && metodos.cartao <= 0;
  const showPix = !!pix || forceShow.pix || !metodos || metodos.pix > 0 || nadaNosDois;
  const showCartao = !!cartao || forceShow.cartao || !metodos || metodos.cartao > 0;

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
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-bold text-amber-400">Extrato do dia — {contexto}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {showPix && showCartao ? (
          <>Suba o extrato do <b className="text-foreground">Pix</b> e da <b className="text-foreground">maquininha</b>. </>
        ) : showPix ? (
          <>Seu dia foi só <b className="text-foreground">Pix</b> — um envio resolve. </>
        ) : (
          <>Seu dia foi só <b className="text-foreground">maquininha</b> — um envio resolve. </>
        )}
        A IA confere na hora e só o que entrou (cartão + pix) vale no ranking. Dá pra reenviar se cair mais Pix.
      </p>
      <p className="text-[11px] font-semibold text-amber-400/90">
        Conta pro dia {diaLabel} · você pode enviar o extrato até as 9h da manhã.
      </p>
      {inX1 && (
        <p className="text-[11px] font-bold text-red-400">
          ⚔️ Este envio JÁ vale pro seu X1 — o resultado sai sozinho às 9h. Nada mais pra mandar.
        </p>
      )}
      <div className="flex gap-2">
        {showPix && slotBtn("pix", "Extrato Pix", Smartphone, pix, pixRef)}
        {showCartao && slotBtn("cartao", "Extrato Cartão", CreditCard, cartao, cartaoRef)}
      </div>
      {(!showCartao || !showPix) && (
        <button
          onClick={() => setForceShow((s) => ({ pix: s.pix || !showPix, cartao: s.cartao || !showCartao }))}
          className="text-[10px] text-muted-foreground underline"
        >
          {!showCartao ? "Recebi no cartão fora do DEFCON — enviar extrato da maquininha" : "Recebi Pix fora do DEFCON — enviar extrato do Pix"}
        </button>
      )}
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
      {avisos.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-amber-400">Não contaram ({avisos.length}) — o porquê:</p>
          {avisos.slice(0, 8).map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-[11px] leading-snug">
              <span className="text-muted-foreground flex-1">
                {a.motivo ?? "não contou"}{a.descricao ? ` · ${a.descricao}` : ""}
              </span>
              {a.valor ? <span className="text-amber-400 font-semibold shrink-0">{formatCurrency(Number(a.valor))}</span> : null}
            </div>
          ))}
          {avisos.length > 8 && <p className="text-[10px] text-muted-foreground/70">+{avisos.length - 8} outro(s)</p>}
        </div>
      )}
      <input ref={pixRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile("pix", e)} />
      <input ref={cartaoRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile("cartao", e)} />
    </div>
  );
}
