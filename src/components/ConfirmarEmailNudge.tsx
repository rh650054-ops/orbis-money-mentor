import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

const SNOOZE_DIAS = 3;

/**
 * Empurrão único: quem ainda não confirmou o e-mail vê este card na Home até
 * confirmar. "Depois" esconde por 3 dias (só neste aparelho). Ao tocar, vai
 * direto pro card de confirmação nas Configurações, já aberto.
 * Decisão do Rick (29/09): recuperação de senha por e-mail exige e-mail
 * confirmado — então a confirmação precisa acontecer cedo, não no dia do aperto.
 */
export default function ConfirmarEmailNudge({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const snoozeKey = `orbis_email_nudge_ate_${userId}`;
    try {
      const ate = localStorage.getItem(snoozeKey);
      if (ate && Number(ate) > Date.now()) return;
    } catch (e) {
      avisar.silencioso("ConfirmarEmailNudge: ler snooze", e);
    }
    let cancel = false;
    // email_verificado_em ainda não está nos types gerados (mesmo padrão do Auth.tsx)
    (supabase as any)
      .from("profiles")
      .select("email_verificado_em")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { email_verificado_em: string | null } | null }) => {
        if (!cancel && data && !data.email_verificado_em) setShow(true);
      });
    return () => { cancel = true; };
  }, [userId]);

  if (!show) return null;

  const depois = () => {
    try {
      localStorage.setItem(`orbis_email_nudge_ate_${userId}`, String(Date.now() + SNOOZE_DIAS * 86_400_000));
    } catch (e) {
      avisar.silencioso("ConfirmarEmailNudge: gravar snooze", e);
    }
    setShow(false);
  };

  return (
    <div
      className="relative w-full rounded-2xl p-4 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{
        background: "linear-gradient(180deg, hsl(var(--primary) / 0.16), rgba(255,255,255,0.02))",
        border: "1px solid hsl(var(--primary) / 0.4)",
      }}
    >
      <button onClick={depois} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label="Depois">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 mb-1.5 pr-5">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "hsl(var(--primary) / 0.18)", border: "1px solid hsl(var(--primary) / 0.4)" }}>
          <MailCheck className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
        </span>
        <h4 className="text-sm font-black text-foreground leading-tight">Confirme seu e-mail em 10 segundos</h4>
      </div>
      <p className="text-[13px] text-foreground/85 leading-snug">
        Assim, se um dia esquecer a senha, você recupera sozinho na hora — sem depender do suporte.
      </p>
      <button
        onClick={() => navigate("/settings?confirmar=email")}
        className="w-full h-11 mt-3 rounded-xl font-extrabold text-sm text-primary-foreground active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(180deg, hsl(45 100% 58%), hsl(var(--primary)))" }}
      >
        Confirmar agora
      </button>
      <button onClick={depois} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1">
        Depois
      </button>
    </div>
  );
}
