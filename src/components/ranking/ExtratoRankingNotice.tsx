import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";

// Aviso da nova regra: o valor só entra no ranking depois do extrato enviado.
// Dispensável por usuário (localStorage) pra não ficar repetindo pra sempre.
const KEY_PREFIX = "orbis_extrato_rule_notice_v1_";

export function ExtratoRankingNotice({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return userId ? localStorage.getItem(KEY_PREFIX + userId) === "1" : false;
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      if (userId) localStorage.setItem(KEY_PREFIX + userId, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-4 space-y-2.5">
      <button
        onClick={close}
        className="absolute top-2.5 right-2.5 text-muted-foreground active:scale-90"
        aria-label="Fechar aviso"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 pr-6">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <h3 className="text-sm font-black text-foreground">Ranking agora é 100% verificado</h3>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        A partir de hoje, seu faturamento só entra no ranking{" "}
        <b className="text-foreground">depois que você enviar o extrato do dia</b> — o do banco (Pix)
        e o da maquininha (cartão). É o que garante um ranking justo, sem valor inflado. As vendas em
        dinheiro continuam nos seus relatórios normalmente.
      </p>

      <Button size="sm" className="w-full" onClick={() => navigate("/daily-goals")}>
        Enviar meu extrato
      </Button>
    </div>
  );
}
