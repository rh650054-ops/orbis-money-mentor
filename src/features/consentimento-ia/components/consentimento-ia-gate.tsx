/* Asks once, after login, before any data goes to a third-party AI (23/11/2026, all platforms).
   Also answers EVENTO_IA_DESLIGADA: a user-started AI feature was blocked → explain and offer to turn it on. */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { EVENTO_IA_DESLIGADA } from "@/shared/lib/consentimento-ia";
import { Botao, Folha } from "@/shared/components/vant-ui";
import { useConsentimentoIa, useResponderConsentimentoIa } from "../api/use-consentimento-ia";
import { TextoIa } from "./texto-ia";

export function ConsentimentoIaGate() {
  const { user } = useAuth();
  const consentimento = useConsentimentoIa(user?.id);
  const responder = useResponderConsentimentoIa(user?.id);
  const [desligadaAberta, setDesligadaAberta] = useState(false);

  useEffect(() => {
    const abrir = () => setDesligadaAberta(true);
    window.addEventListener(EVENTO_IA_DESLIGADA, abrir);
    return () => window.removeEventListener(EVENTO_IA_DESLIGADA, abrir);
  }, []);

  if (!user) return null;
  const naoRespondeu = consentimento.isSuccess && consentimento.data === null;
  const aberta = naoRespondeu || desligadaAberta;

  const escolher = (permitido: boolean) =>
    responder.mutate(permitido, {
      onSuccess: () => {
        setDesligadaAberta(false);
        toast({ title: permitido ? "IA ativada" : "IA desligada", description: permitido ? undefined : "Dá pra ativar em Minha Conta quando quiser." });
      },
      onError: () => toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }),
    });

  return (
    <Folha aberta={aberta} onFechar={() => setDesligadaAberta(false)}
      titulo={naoRespondeu ? "A VANT usa IA. Você autoriza?" : "A IA está desligada"}
      sub={naoRespondeu ? "Sua escolha vale pra esta conta." : "Essa função usa IA. Pra usar, autorize abaixo."}>
      <TextoIa />
      <div className="grid grid-cols-2 gap-2">
        <Botao onClick={() => escolher(false)} disabled={responder.isPending}>Agora não</Botao>
        <Botao tipo="ouro" onClick={() => escolher(true)} disabled={responder.isPending}>Permitir</Botao>
      </div>
    </Folha>
  );
}
