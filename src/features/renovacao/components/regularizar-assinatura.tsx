/* The right renewal path (Rick, 26/11/2026), shown instead of a checkout Hotmart would refuse
   ("plano já foi comprado anteriormente"). Used by the in-app sheet and by /assinar?t=…
     regularizar / pendente → pay the charge that already exists (Pix here, or the Hotmart area)
                               + "Já paguei, conferir" (asks Hotmart, releases when paid)
     conciliar              → paid at Hotmart: checks and releases on its own
     em_dia                 → already active: nothing to pay again
   When the check finds the old subscription closed at Hotmart, a new checkout is offered.
   With gerarPixLigado() (off in production until the real Pix is validated) the overdue case
   becomes "Regularize sua assinatura": plan, pending fee and "Gerar Pix" (gerar-pix.tsx). */
import { useEffect, useState } from "react";
import type { Caminho } from "@/shared/lib/caminho-assinatura";
import { conferirNaHotmart, dataBR } from "@/shared/lib/caminho-assinatura";
import { abrirLinkExterno } from "@/shared/lib/link-externo";
import type { RenovacaoPix } from "../api/use-renovacao-pix";
import { HOTMART_AREA_CLIENTE, gerarPixLigado } from "../lib/pix";
import { GerarPix } from "./gerar-pix";
import { RenovarPix } from "./renovar-pix";

const GOLD = "#F5B800";
const MUTE = "#9a948a";
const BOTAO = "w-full h-12 rounded-[14px] text-[14.5px] font-black";

const TITULO: Record<Caminho["acao"], string> = {
  regularizar: "Seu pagamento está atrasado",
  pendente: "Seu primeiro pagamento ainda está em aberto",
  conciliar: "Conferindo seu pagamento",
  em_dia: "Sua assinatura já está ativa",
  nova: "Pode assinar de novo",
};

export function RegularizarAssinatura({ caminho, pix, token, userId, onLiberado, onNovaAssinatura }: {
  caminho: Caminho; pix: RenovacaoPix | null; token?: string | null;
  /** the logged-in person (in-app sheet): lets an already generated Pix show at once */
  userId?: string;
  onLiberado: () => void;
  /** the old subscription is closed at Hotmart: a new checkout is valid now */
  onNovaAssinatura?: () => void;
}) {
  const [atual, setAtual] = useState(caminho);
  const [conferindo, setConferindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const plano = atual.plano ?? "VANT";
  const proxima = dataBR(atual.proxima_cobranca);
  const comPix = gerarPixLigado();
  const regularizarPorPix = comPix && atual.acao === "regularizar";

  /** silencioso: automatic check (back from the bank app) — says nothing when it is not paid yet */
  const conferir = async (silencioso = false) => {
    setConferindo(true); setAviso(null);
    const r = await conferirNaHotmart(token);
    setConferindo(false);
    if (!r) { if (!silencioso) setAviso("Não consegui falar com a Hotmart agora. Tente de novo em 1 minuto."); return; }
    if (r.liberado || r.caminho?.acao === "em_dia") { onLiberado(); return; }
    if (r.caminho) setAtual(r.caminho);
    if (r.caminho?.acao === "nova") return;
    if (silencioso) return;
    setAviso(r.limitado ? "Acabei de conferir. Espere 1 minuto e toque de novo." : "A Hotmart ainda não confirmou o pagamento. Pix pode levar alguns minutos.");
  };
  // paid at Hotmart but blocked here: check on its own
  useEffect(() => { if (caminho.acao === "conciliar") void conferir(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="flex flex-col gap-3 text-left">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black tracking-[.14em]" style={{ color: GOLD }}>{plano.toUpperCase()}</p>
          {regularizarPorPix && <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: "#3a1c0a", color: "#FF8A3D" }}>Pagamento pendente</span>}
        </div>
        <p className="text-[20px] font-black leading-tight mt-1">{regularizarPorPix ? "Regularize sua assinatura" : TITULO[atual.acao]}</p>
        <p className="text-[13px] leading-snug mt-1.5" style={{ color: MUTE }}>
          {regularizarPorPix ? "Pague sua mensalidade pendente pelo Pix para continuar utilizando a VANT."
            : atual.acao === "em_dia" ? `Não precisa pagar de novo.${proxima ? ` A próxima cobrança é em ${proxima}.` : ""}`
            : atual.acao === "nova" ? "A assinatura anterior foi encerrada na Hotmart. Uma nova assinatura é o caminho certo agora."
            : atual.acao === "conciliar" ? "A Hotmart mostra sua assinatura ativa. Estou liberando seu acesso."
            : "Não precisa criar outra assinatura nem outra conta: é só pagar a cobrança que já existe. Quando o pagamento cair, a VANT libera sozinha."}
        </p>
      </div>
      {(atual.acao === "regularizar" || atual.acao === "pendente") && (pix
        ? <RenovarPix pix={pix} titulo={atual.acao === "pendente" ? "Seu Pix está pronto para pagar" : "Pague o Pix da sua renovação"} />
        : regularizarPorPix
        ? <GerarPix plano={plano} valor={atual.valor} userId={userId} token={token} onVerificar={(silencioso) => void conferir(silencioso)} onEncerrada={() => void conferir()} />
        : <button type="button" onClick={() => void abrirLinkExterno(HOTMART_AREA_CLIENTE)} className={BOTAO}
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            Pagar na Hotmart
          </button>)}
      {(atual.acao === "regularizar" || atual.acao === "pendente") && !pix && !regularizarPorPix && (
        <p className="text-[12px] leading-snug" style={{ color: MUTE }}>Na Hotmart: “Minhas compras” → VANT → pague ou troque o cartão. Entre com o e-mail usado na compra.</p>
      )}
      {atual.acao !== "em_dia" && atual.acao !== "nova" && (
        <button type="button" disabled={conferindo} onClick={() => void conferir()} className={`${BOTAO} disabled:opacity-60`}
          style={{ background: "#151515", border: "1px solid #2c2a25", color: "#F4F1EA" }}>
          {comPix ? (conferindo ? "Verificando o pagamento…" : "Já paguei, verificar pagamento") : conferindo ? "Conferindo na Hotmart…" : "Já paguei, conferir"}
        </button>
      )}
      {atual.acao === "em_dia" && (
        <button type="button" onClick={() => void abrirLinkExterno(HOTMART_AREA_CLIENTE)} className={BOTAO} style={{ background: "#151515", border: "1px solid #2c2a25", color: "#F4F1EA" }}>
          Ver minha assinatura na Hotmart
        </button>
      )}
      {atual.acao === "nova" && onNovaAssinatura && (
        <button type="button" onClick={onNovaAssinatura} className={BOTAO} style={{ background: GOLD, color: "#1A1200" }}>{comPix ? "Assinar novamente" : "Continuar para o pagamento"}</button>
      )}
      {aviso && <p className="text-[12.5px] font-bold leading-snug" style={{ color: "#FF9A3D" }}>{aviso}</p>}
    </div>
  );
}
