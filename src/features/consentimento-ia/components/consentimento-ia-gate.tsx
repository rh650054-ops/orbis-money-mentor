/* AI permission (23/11/2026, all platforms). Normally asked on the Terms acceptance screen
   (AceiteTermosModal, separate unchecked box). This sheet covers the rest:
   - Terms already current but AI never answered (e.g. accepted at sign-up) → asks once;
   - EVENTO_IA_DESLIGADA: a user-started AI feature was blocked → explain and offer to turn it on.
     A vendor who allowed an older text that still counts is only asked here, when using a feature
     that entered the text later (never out of the blue). */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { EVENTO_IA_DESLIGADA } from "@/shared/lib/consentimento-ia";
import { Botao, Folha } from "@/shared/components/vant-ui";
import { useConsentimentoIa, useResponderConsentimentoIa } from "../api/use-consentimento-ia";
import { useTermosEmDia } from "../api/use-termos-em-dia";
import { TextoIa } from "./texto-ia";

/* Never on top of these: the onboarding (it has its own inputs and the sheet stole their focus,
   so the iPhone keyboard jumped open and shut), the login and the documents being read. */
const FORA = ["/onboarding-novo", "/auth", "/force-password-change", "/termos", "/privacidade"];

export function ConsentimentoIaGate() {
  const { user } = useAuth();
  const consentimento = useConsentimentoIa(user?.id);
  const responder = useResponderConsentimentoIa(user?.id);
  const termos = useTermosEmDia(user?.id);
  const { pathname } = useLocation();
  const [desligadaAberta, setDesligadaAberta] = useState(false);

  useEffect(() => {
    const abrir = () => setDesligadaAberta(true);
    window.addEventListener(EVENTO_IA_DESLIGADA, abrir);
    return () => window.removeEventListener(EVENTO_IA_DESLIGADA, abrir);
  }, []);

  // Terms not current → AceiteTermosModal asks both on one screen; never two screens in a row.
  const naoRespondeu = !!user && consentimento.isSuccess && consentimento.data === null && termos.data === true && !FORA.includes(pathname);
  const aberta = naoRespondeu || desligadaAberta;
  // already allowed, but on an older text: the blocked feature is one the current text added
  const funcaoNova = desligadaAberta && consentimento.data === true && !consentimento.textoAtual;
  // iPhone: a text field still focused underneath kept the keyboard up behind the sheet
  useEffect(() => { if (aberta) (document.activeElement as HTMLElement | null)?.blur?.(); }, [aberta]);

  if (!user) return null;

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
      titulo={naoRespondeu ? "A VANT usa IA. Você autoriza?" : funcaoNova ? "Essa função é nova na IA" : "A IA está desligada"}
      sub={naoRespondeu ? "Sua escolha vale pra esta conta." : funcaoNova ? "Ela entrou na lista abaixo depois da sua autorização. Pra usar, autorize de novo." : "Essa função usa IA. Pra usar, autorize abaixo."}>
      <TextoIa />
      <div className="grid grid-cols-2 gap-2">
        <Botao onClick={() => escolher(false)} disabled={responder.isPending}>Agora não</Botao>
        <Botao tipo="ouro" onClick={() => escolher(true)} disabled={responder.isPending}>Permitir</Botao>
      </div>
    </Folha>
  );
}
