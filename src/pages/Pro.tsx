/* ============================================================
   /pro — a paywall do Vant Pro como tela própria (fluxo da aba Vender,
   03/10/2026): Vender → convite pra conectar → aqui → Hotmart → widget do
   banco. Quem já é Pro não precisa dela: volta pra Vender.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PaywallPro } from "@/components/conectar/PaywallPro";
import { carregarPro } from "@/components/conectar/pluggy";
import { useVoltaDoCheckout } from "@/hooks/useVoltaDoCheckout";

const MUTE = "#7b766e";

export default function Pro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ehPro, setEhPro] = useState<boolean | null>(null);
  const [jaTinhaBanco, setJaTinhaBanco] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    carregarPro().then((p) => { if (vivo) { setEhPro(p.pro); setJaTinhaBanco(!!p.liberado); } });
    return () => { vivo = false; };
  }, [user?.id]);

  // já é Pro: a paywall não tem o que vender; segue pra ligar o banco
  useEffect(() => { if (ehPro) navigate("/verificar", { replace: true }); }, [ehPro, navigate]);

  // voltou da Hotmart: confere sozinho e segue pra ligar o banco. Quem já tinha o
  // banco avulso só conta quando virar Pro (senão "confirmava" na hora, sem compra).
  useVoltaDoCheckout({
    ativo: !!user?.id && ehPro === false,
    verificar: () => carregarPro().then((p) => p.pro || (!!p.liberado && !jaTinhaBanco)),
    aoLiberar: () => navigate("/verificar", { replace: true }),
  });

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
      <div className="mt-1" data-tour="conectar-banco"><PaywallPro /></div>
    </div>
  );
}
