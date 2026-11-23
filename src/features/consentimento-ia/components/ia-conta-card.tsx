/* Minha Conta: the AI consent switch, with the same explanation as the first-login sheet. */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { Botao, LinhaToggle, Secao } from "@/shared/components/vant-ui";
import { useConsentimentoIa, useResponderConsentimentoIa } from "../api/use-consentimento-ia";
import { TextoIa } from "./texto-ia";

export function IaContaCard() {
  const { user } = useAuth();
  const consentimento = useConsentimentoIa(user?.id);
  const responder = useResponderConsentimentoIa(user?.id);
  const [detalhe, setDetalhe] = useState(false);
  const ligado = consentimento.data === true;

  return (
    <Secao titulo="INTELIGÊNCIA ARTIFICIAL" id="sec-ia">
      <LinhaToggle titulo="Usar IA na VANT" ligado={ligado} disabled={consentimento.isLoading || responder.isPending}
        sub={ligado ? "Dicas, relatórios, mentor e leitura de nota ligados" : "Nada é enviado pra IA. Dicas, mentor e leitura de nota ficam desligados"}
        onChange={(v) => responder.mutate(v, {
          onSuccess: () => toast({ title: v ? "IA ativada" : "IA desligada" }),
          onError: () => toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }),
        })} />
      {detalhe ? <div className="pt-2"><TextoIa /></div>
        : <Botao tipo="texto" className="px-0 h-8" onClick={() => setDetalhe(true)}>O que é enviado e pra quem</Botao>}
    </Secao>
  );
}
