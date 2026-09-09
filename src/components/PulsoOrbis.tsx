/* ============================================================
   PulsoOrbis — o sensor pendurado no roteador.

   Fica ao lado do RankingAlertas, FORA do Layout, porque o DEFCON e o modo
   offline são telas de tela cheia que não passam pelo Layout — e o DEFCON é
   justamente a tela onde a retenção mais importa.

   Não desenha nada. Não pede permissão. Não gasta IA.
   ============================================================ */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pulsoLigar, pulsoTela, nomeDaTela } from "@/shared/lib/pulso";

export default function PulsoOrbis() {
  const location = useLocation();

  useEffect(() => {
    pulsoLigar();
  }, []);

  useEffect(() => {
    pulsoTela(nomeDaTela(location.pathname));
  }, [location.pathname]);

  return null;
}
