/* /planos — os 3 planos da VANT (Pro Anual, Pro Mensal, Essencial) numa tela.
   Aberta pela missão do dia, pela oferta do fim do Foco e por quem já expirou. */
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EscolhaPlano } from "@/components/jornada/EscolhaPlano";
import { useJornada } from "@/components/jornada/useJornada";

export default function Planos() {
  const navigate = useNavigate();
  const { vendidoNoTeste } = useJornada();
  return (
    <div className="min-h-screen px-4 pt-4 pb-16 max-w-xl mx-auto text-[#F4F1EA]" style={{ background: "#000" }}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: "#7b766e" }}>PLANOS DA VANT</p>
        <span className="w-9" />
      </div>
      <EscolhaPlano vendido={vendidoNoTeste} />
    </div>
  );
}
