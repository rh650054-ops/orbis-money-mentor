/* Depois do treino do Foco e do ranking: "Agora cadastre o que você vende".
   Aparece no ranking só quando ele chegou do treino (?depoisTreino=1) e ainda
   não tem produto. "Faço depois" fecha; o passo continua na missão do Início. */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProdutosQuery } from "../api/use-produtos-query";
import { OURO } from "./quiz-casca";

export function ConviteProduto() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const doTreino = new URLSearchParams(search).get("depoisTreino") === "1";
  const { data } = useProdutosQuery(doTreino ? user?.id : undefined);
  const [visivel, setVisivel] = useState(false);
  const [fechou, setFechou] = useState(false);

  useEffect(() => {
    if (!doTreino) return;
    const t = setTimeout(() => setVisivel(true), 2500); // deixa ele ver a posição primeiro
    return () => clearTimeout(t);
  }, [doTreino]);

  if (!doTreino || fechou || !visivel || !data || data.length > 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
      <div className="max-w-md mx-auto rounded-[22px] p-4 flex flex-col gap-2.5 shadow-2xl animate-in slide-in-from-bottom-6 duration-300"
        style={{ background: "#0b0b0c", border: "1px solid rgba(245,184,0,.35)" }}>
        <span className="text-[10.5px] font-black tracking-[.16em]" style={{ color: "#3DD68C" }}>TREINO CONCLUÍDO</span>
        <span className="text-[22px] font-black tracking-tight leading-[1.1] text-[#F4F1EA]">Agora cadastre o que você vende</span>
        <span className="text-[13px] leading-snug" style={{ color: "#b9b3a6" }}>
          Leva 1 minuto. Você descobre quanto sobra em cada venda, e no Foco seus produtos já aparecem prontos pra vender.
        </span>
        <button type="button" onClick={() => navigate("/products/novo")} className="w-full h-[52px] rounded-2xl text-[15px] font-black mt-1" style={{ background: OURO, color: "#1A1200" }}>
          CADASTRAR MEU PRODUTO
        </button>
        <button type="button" onClick={() => setFechou(true)} className="text-[13px] font-extrabold underline" style={{ color: "#b9b3a6" }}>
          faço depois
        </button>
      </div>
    </div>
  );
}
