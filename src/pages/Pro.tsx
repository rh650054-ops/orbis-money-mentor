/* ============================================================
   /pro — a paywall do Vant Pro como tela própria (fluxo da aba Vender,
   03/10/2026): Vender → convite pra conectar → aqui → Hotmart → widget do
   banco. Quem já é Pro não precisa dela: volta pra Vender.
   Cortesia (equipe/influenciador): só o Open Finance, R$ 10/mês.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PaywallPro, PaywallCortesia } from "@/components/conectar/PaywallPro";
import { supabase } from "@/integrations/supabase/client";
import { carregarPro } from "@/components/conectar/pluggy";

const MUTE = "#7b766e";

export default function Pro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ehPro, setEhPro] = useState<boolean | null>(null);
  // app de cortesia (equipe/influenciador): a oferta é só o Open Finance a R$ 10
  const [cortesia, setCortesia] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    carregarPro().then((p) => { if (vivo) setEhPro(p.pro); });
    supabase.from("profiles").select("billing_exempt").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (vivo) setCortesia(!!(data as { billing_exempt?: boolean } | null)?.billing_exempt); });
    return () => { vivo = false; };
  }, [user?.id]);

  // já é Pro: a paywall não tem o que vender; segue pra ligar o banco
  useEffect(() => { if (ehPro) navigate("/verificar", { replace: true }); }, [ehPro, navigate]);

  if (!user?.id) return null;

  return (
    <div className="min-h-screen px-4 pt-4 pb-28 max-w-2xl mx-auto" style={{ background: "#000" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: MUTE }}>VANT PRO</p>
        <span className="w-9" />
      </div>
      <div className="mt-1" data-tour="conectar-banco">{cortesia ? <PaywallCortesia email={user.email} /> : <PaywallPro />}</div>
    </div>
  );
}
