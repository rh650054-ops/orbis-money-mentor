import { useNavigate } from "react-router-dom";
import { toast } from "@/shared/hooks/use-toast";
import { GoldenTicket } from "@/components/competitions/GoldenTicket";

// Preview do bilhete dourado — pra ver, testar (arrastar + som) e personalizar.
// Dados de exemplo (o padrão do mockup). Depois ligamos no fluxo da competição.
export default function BilhetePreview() {
  const navigate = useNavigate();
  return (
    <GoldenTicket
      introTitulo="Primeiro Desafio — Meta Batida"
      introSub="Um dos pioneiros do maior movimento de vendedores do Brasil."
      grandPrizeLabel="🏆 Grande Prêmio do Mês"
      grandPrizeValue="R$500"
      grandPrizeDesc="Para o maior vendedor do mês — no Pix, ao vivo"
      miniPrizes={[
        { valor: "R$100", label: "TOP 1 DA SEMANA\ntoda sexta" },
        { valor: "R$50", label: "POR 3 INDICAÇÕES\nna semana" },
      ]}
      commissionTitle="Ganhe indicando — quanto mais trouxer, mais ganha"
      commissionTiers={[
        { nome: "Até 10 indicados", val: "R$5/cada" },
        { nome: "De 11 a 30 indicados", val: "R$7/cada" },
        { nome: "A partir de 31 indicados", val: "R$10/cada" },
      ]}
      commissionNote="Cada faixa vale para os indicados dentro dela. Quanto mais você traz, mais alta fica sua faixa."
      onAccept={() => {
        toast({ title: "Desafio aceito! 🔥", description: "Bora pro topo do ranking." });
        navigate("/competitions");
      }}
    />
  );
}
