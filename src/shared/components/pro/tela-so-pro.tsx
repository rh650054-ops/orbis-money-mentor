/* TELA "RECURSO DO PRO" (Rick, 25/10/2026): o que aparece quando quem tem o Essencial
   abre algo que é do VANT Pro. Em cima, o que o recurso faz; no meio, uma prévia FOSCA
   (dados de exemplo ou dele) mostrando o que ele teria; embaixo, os planos do Pro. */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PaywallPro } from "@/components/conectar/PaywallPro";
import { DadoPro } from "./dado-pro";

const GOLD = "#F5B800";

export function TelaSoPro({ icone, titulo, texto, previa, comEssencial = false }: {
  icone: ReactNode; titulo: string; texto: string; previa?: ReactNode; comEssencial?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen px-4 pt-4 pb-28 max-w-2xl mx-auto text-[#F4F1EA]" style={{ background: "#000" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: "#7b766e" }}>VANT PRO</p>
        <span className="w-9" />
      </div>
      <div className="mt-2 rounded-[18px] p-4 flex items-start gap-3" style={{ border: `1px solid ${GOLD}55`, background: "linear-gradient(170deg,#1a1305,#0e0e0f 70%)" }}>
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: GOLD }}>{icone}</span>
        <span>
          <span className="block text-[16px] font-black">{titulo}</span>
          <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: "#b9b3a6" }}>{texto}</span>
        </span>
      </div>
      {previa && <div className="mt-3"><DadoPro travado chamada="Libera com o Pro" acao="Ver planos">{previa}</DadoPro></div>}
      <div className="mt-3"><PaywallPro comEssencial={comEssencial} /></div>
    </div>
  );
}
