/* "Gerar Pix" (Rick, 26/11/2026): the overdue subscriber pays the pending monthly fee without
   leaving VANT. One tap asks Hotmart (official negotiation) for the Pix; a Pix that already exists
   and is still valid is shown again, never a second one. When Hotmart's answer was lost (a charge
   may exist), "Gerar Pix" is BLOCKED until the server reconciles; "Conferir de novo" only asks the
   server to read Hotmart again, it never creates a charge. While the real integration is not
   validated this component only renders when gerarPixLigado() (lib/pix.ts). */
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { abrirLinkExterno } from "@/shared/lib/link-externo";
import { useGerarPixMutation, useNegociacaoPixQuery } from "../api/use-gerar-pix";
import type { RenovacaoPix } from "../api/use-renovacao-pix";
import { HOTMART_AREA_CLIENTE, avisoDoGerarPix, reais, venceTexto } from "../lib/pix";
import { BotaoCopiarPix } from "./renovar-pix";

const MUTE = "#9a948a";
const OURO = { background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" };
const BOTAO = "w-full h-12 rounded-[14px] text-[14.5px] font-black inline-flex items-center justify-center gap-2";

export function GerarPix({ plano, valor, userId, token, onVerificar, onEncerrada }: {
  plano: string; valor?: number | null; userId?: string; token?: string | null;
  /** asks Hotmart whether the payment arrived (the parent's "Já paguei, verificar pagamento");
      silencioso = automatic check, no message when it is not paid yet */
  onVerificar: (silencioso: boolean) => void;
  /** Hotmart says the subscription is closed: the parent offers "Assinar novamente" */
  onEncerrada: () => void;
}) {
  const estado = useNegociacaoPixQuery(userId, !token).data ?? null;
  const gerar = useGerarPixMutation(token);
  const resposta = gerar.data ?? null;
  const pix = resposta?.pix ?? estado?.pix ?? null;
  // uncertain request: blocked until the reconciliation; the last answer wins over what was loaded
  const bloqueado = resposta ? resposta.acao === "incerto" : estado?.bloqueado === true;

  useEffect(() => {
    if (!resposta || resposta.pix) return;
    if (resposta.motivo === "encerrada") onEncerrada();
    else if (resposta.acao === "ja_paga" || resposta.motivo === "em_dia") onVerificar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resposta]);

  // back from the bank app with a Pix on screen: check the payment without asking for a tap
  useEffect(() => {
    if (!pix) return;
    const voltou = () => { if (document.visibilityState === "visible") onVerificar(true); };
    document.addEventListener("visibilitychange", voltou);
    return () => document.removeEventListener("visibilitychange", voltou);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pix]);

  const valorDoPix = pix?.valor ?? valor ?? null;
  const caixaValor = (rotulo: string, v: number) => (
    <div className="rounded-[16px] px-4 py-3 text-center" style={{ background: "#1c1c1d" }}>
      <p className="text-[11.5px]" style={{ color: MUTE }}>{rotulo}</p>
      <p className="text-[22px] font-black leading-tight mt-0.5">{reais(v)}</p>
    </div>
  );

  if (pix) {
    const paraCopiar = { pix_code: pix.pix_code, valor: valorDoPix ?? 0 } as RenovacaoPix;
    return (
      <section aria-label="Pix da mensalidade" className="flex flex-col gap-3">
        {valorDoPix ? caixaValor("Mensalidade pendente", valorDoPix) : null}
        <div className="mx-auto rounded-xl bg-white p-2.5"><QRCodeSVG value={pix.pix_code} size={168} aria-label="QR Code do Pix" /></div>
        <BotaoCopiarPix pix={paraCopiar} rotulo="Copiar código Pix" className={BOTAO} style={OURO} />
        <p className="text-[12.5px] leading-snug text-center" style={{ color: MUTE }}>
          {pix.vence_em ? <>Este Pix <b className="text-[#F4F1EA]">{venceTexto(pix.vence_em)}</b>. </> : null}
          Pague no app do seu banco em “Pix copia e cola”. A VANT libera sozinha quando o pagamento cair.
        </p>
      </section>
    );
  }

  const aviso = resposta && resposta.motivo !== "encerrada" && resposta.acao !== "ja_paga" && resposta.motivo !== "em_dia" ? avisoDoGerarPix(resposta)
    : bloqueado ? avisoDoGerarPix({ acao: "incerto" }) : null;
  return (
    <section aria-label="Pix da mensalidade" className="flex flex-col gap-3">
      {valor ? caixaValor(`Mensalidade ${plano}`, valor) : null}
      <button type="button" disabled={gerar.isPending || bloqueado} onClick={() => gerar.mutate()} className={`${BOTAO} disabled:opacity-50`} style={OURO}>
        <QrCode className="w-4 h-4" strokeWidth={2.6} /> {bloqueado ? "Gerar Pix bloqueado" : gerar.isPending ? "Gerando seu Pix…" : "Gerar Pix"}
      </button>
      {aviso && <p role="alert" className="text-[12.5px] font-bold leading-snug" style={{ color: "#FF9A3D" }}>{aviso.texto}</p>}
      {bloqueado && (
        <button type="button" disabled={gerar.isPending} onClick={() => gerar.mutate()} className={`${BOTAO} disabled:opacity-60`} style={{ background: "#151515", border: "1px solid #2c2a25", color: "#F4F1EA" }}>
          {gerar.isPending ? "Conferindo com a Hotmart…" : "Conferir de novo"}
        </button>
      )}
      {aviso?.hotmart && (
        <button type="button" onClick={() => void abrirLinkExterno(HOTMART_AREA_CLIENTE)} className={BOTAO} style={{ background: "#151515", border: "1px solid #2c2a25", color: "#F4F1EA" }}>
          Pagar na Hotmart
        </button>
      )}
    </section>
  );
}
