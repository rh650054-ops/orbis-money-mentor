import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { FileText, Clock, Smartphone, CreditCard } from "lucide-react";
import { getExtratoDia } from "@/shared/lib/date-utils";
import { extratoDeadlineLabel } from "@/shared/lib/extrato-config";

// Popup bonito no FIM do DEFCON: lembra o usuário de subir o extrato do dia
// (pra valer no ranking/competições). Aparece 1x por dia e some se já subiu.
export default function ExtratoDailyModal({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dia = getExtratoDia();
  const diaLabel = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      // Só NÃO aparece se a pessoa já subiu o extrato do dia (aí não precisa incomodar).
      // Se ainda não subiu, aparece SEMPRE que o DEFCON termina — pra reforçar o envio.
      const { data } = await supabase
        .from("extrato_uploads")
        .select("tipo")
        .eq("user_id", userId)
        .eq("dia", dia)
        .limit(1);
      if (!alive) return;
      if (data && data.length > 0) return;
      setOpen(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, dia]);

  const dismiss = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent
        className="max-w-sm rounded-[28px] border-amber-500/40 bg-[#0c0c0f] p-0 overflow-hidden [&>button]:hidden"
        style={{ boxShadow: "0 20px 60px -15px rgba(245,181,68,0.45)" }}
      >
        <div
          className="relative px-6 pt-8 pb-5 text-center"
          style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(245,181,68,0.16) 0%, transparent 58%)" }}
        >
          <div
            className="mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center border-2 border-amber-400 animate-in zoom-in-50 duration-500"
            style={{ background: "rgba(245,181,68,0.12)", boxShadow: "0 0 32px -4px rgba(245,181,68,0.6)" }}
          >
            <FileText className="w-9 h-9 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-foreground leading-tight px-2">Suba seu extrato de hoje! 📄</h2>
          <p className="mt-2 text-sm text-muted-foreground px-1">
            Pra suas vendas de <b className="text-foreground">{diaLabel}</b> valerem no ranking e nas competições, mande o extrato do{" "}
            <b className="text-amber-400">Pix</b> e da <b className="text-amber-400">maquininha</b>.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[12px] font-bold text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Até as {extratoDeadlineLabel()} de amanhã
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-amber-400/80" /> Extrato Pix</span>
            <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-amber-400/80" /> Extrato Cartão</span>
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground/80 px-2">
            Só cartão e pix contam no ranking — o dinheiro fica salvo no seu relatório. Pix que cair depois é só reenviar.
          </p>
        </div>

        <div className="px-6 pb-6 pt-1 space-y-2">
          <button
            onClick={() => { dismiss(); navigate("/meu-extrato"); }}
            className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 8px 24px -8px rgba(245,181,68,0.7)" }}
          >
            <FileText className="w-4 h-4" /> Enviar extrato agora
          </button>
          <button onClick={dismiss} className="w-full h-9 text-xs text-muted-foreground/80 hover:text-muted-foreground">
            Depois
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
