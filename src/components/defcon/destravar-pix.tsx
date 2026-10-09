/* ============================================================
   DESTRAVAR PIX — só pros sócios (Rick, 09/10).
   Com banco ligado, Pix e maquininha vêm travados pelo banco pra todo mundo.
   Rick e Mohamed podem destravar respondendo a pergunta; a resposta é
   conferida no servidor (pix_destravar), nunca aqui no app.
   ============================================================ */
import { useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

async function perguntar(resposta: string | null): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("pix_destravar", { p_resposta: resposta });
  if (error) { avisar.silencioso("pix_destravar", error); return false; }
  return data === true;
}

/** podeDestravar: este usuário vê o cadeado clicável. destravado: o dia vale o lançado. */
export function usePixDestravado(ativo: boolean) {
  const [podeDestravar, setPode] = useState(false);
  const [destravado, setDestravado] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void perguntar(null).then((ok) => { if (vivo) setPode(ok); });
    return () => { vivo = false; };
  }, [ativo]);
  return { podeDestravar, destravado, destravar: () => setDestravado(true) };
}

/** Grava no dia se ele foi lançado à mão (o banco não mexe mais) ou travado. */
export async function marcarDiaManual(dia: string, manual: boolean): Promise<void> {
  const { error } = await (supabase as any).rpc("pix_dia_manual", { p_dia: dia, p_manual: manual });
  if (error) avisar.silencioso("pix_dia_manual", error);
}

export function BotaoDestravar({ onDestravar }: { onDestravar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [errou, setErrou] = useState(false);

  const conferir = async () => {
    setConferindo(true);
    const ok = await perguntar(resposta);
    setConferindo(false);
    if (ok) { setAberto(false); onDestravar(); return; }
    setErrou(true);
  };

  return (
    <>
      <button type="button" onClick={() => { setResposta(""); setErrou(false); setAberto(true); }}
        className="text-[11px] text-muted-foreground underline underline-offset-2 px-1 active:opacity-70">
        Destravar pra editar
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" /> Destravar Pix e cartão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Qual é o valor de pi dividido por dois?</p>
          <input
            inputMode="decimal" autoFocus value={resposta}
            onChange={(e) => { setResposta(e.target.value); setErrou(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" && resposta.trim()) void conferir(); }}
            className="w-full rounded-lg bg-card border border-border px-3 py-2.5 text-base tabular-nums"
          />
          {errou && <p className="text-xs text-destructive">Resposta errada.</p>}
          <button type="button" disabled={!resposta.trim() || conferindo} onClick={() => void conferir()}
            className="w-full rounded-lg bg-primary text-primary-foreground font-bold py-2.5 disabled:opacity-60 flex items-center justify-center gap-2">
            {conferindo && <Loader2 className="w-4 h-4 animate-spin" />} Destravar
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
