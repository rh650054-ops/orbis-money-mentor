/* Trava de produto e estoque pra quem não é Pro (Rick, 23/10/2026): em vez da tela,
   aparece o convite do VANT Pro na hora. Quem assina o Essencial vê só o upgrade;
   quem não assina ainda (caso raro: teste acabando no meio) vê os 3 planos. */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PaywallPro } from "@/components/conectar/PaywallPro";
import { useAcessoProdutosQuery } from "../api/use-acesso-produtos-query";

const GOLD = "#F5B800";

export function SoProProdutos({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const acesso = useAcessoProdutosQuery(user?.id);
  if (!user?.id || acesso.isLoading) return <div className="min-h-screen" style={{ background: "#000" }} />;
  // sem resposta do banco: não trava quem pode ser Pro
  if (acesso.isError || acesso.data?.liberado) return <>{children}</>;
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
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: GOLD }}>
          <Package className="w-5 h-5" strokeWidth={2.4} />
        </span>
        <span>
          <span className="block text-[16px] font-black">Produtos e estoque são do VANT Pro</span>
          <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: "#b9b3a6" }}>
            Cadastre o que você vende, monte a carga do dia, veja o que acaba e o que mais gira. Sobe pro Pro e libera agora.
          </span>
        </span>
      </div>
      <div className="mt-3"><PaywallPro comEssencial={!acesso.data?.assinaEssencial} /></div>
    </div>
  );
}
