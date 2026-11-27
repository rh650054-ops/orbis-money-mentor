import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import type { ResultadoCompra } from "../types";

const GOLD = "#F5B800";

interface Texto { icone: ReactNode; titulo: string; texto: string; cor: string }

/** What each end of a purchase attempt says to the customer. Exported for the tests. */
export function textoDoEstado(r: ResultadoCompra): Texto {
  switch (r.estado) {
    case "liberada":
      return { icone: <CheckCircle2 className="w-7 h-7" />, titulo: "Assinatura ativa", texto: "Seu acesso está liberado. Bom trabalho!", cor: "#49d98a" };
    case "pendente_aprovacao":
      return { icone: <Clock className="w-7 h-7" />, titulo: "Compra aguardando aprovação", texto: "A Apple ainda precisa de uma aprovação (do responsável pela conta ou do banco). Nada foi cobrado. Assim que aprovarem, seu acesso libera sozinho.", cor: GOLD };
    case "aguardando_servidor": {
      // recoverable: the payment is safe and the app keeps trying by itself; nothing alarming here
      if (r.motivo === "servidor") return { icone: <ShieldCheck className="w-7 h-7" />, titulo: "Confirmando sua assinatura", texto: "A Apple já confirmou o pagamento. Estamos liberando seu acesso, o que pode levar alguns instantes. Você não será cobrado de novo.", cor: GOLD };
      const porque = r.motivo === "sem_internet" ? "Você está sem internet." : "Entre de novo na sua conta VANT.";
      return { icone: r.motivo === "sem_internet" ? <WifiOff className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />, titulo: "Pagamento recebido", texto: `${porque} Sua compra está guardada e o acesso libera assim que confirmarmos. Você não será cobrado de novo.`, cor: GOLD };
    }
    case "de_outra_conta":
      return { icone: <AlertTriangle className="w-7 h-7" />, titulo: "Compra de outra conta VANT", texto: "A compra da Apple neste iPhone foi feita para outra conta VANT. Entre na conta que fez a compra para liberar o acesso.", cor: GOLD };
    case "recusada":
      // stored by the server but grants nothing to this account (e.g. an Apple test purchase on an
      // account that is not a VANT test account): never shown as an active subscription
      if (r.motivo === "sem_acesso") return { icone: <ShieldCheck className="w-7 h-7" />, titulo: "Compra sem acesso nesta conta", texto: "A Apple registrou a compra, mas ela não libera acesso nesta conta VANT. Você não será cobrado de novo. Se precisar de ajuda, fale com o suporte da VANT.", cor: GOLD };
      return r.motivo === "reembolsada"
        ? { icone: <AlertTriangle className="w-7 h-7" />, titulo: "Esta compra foi reembolsada", texto: "A Apple devolveu o valor desta compra, então ela não libera acesso. Você pode assinar de novo quando quiser.", cor: "#ff7d6b" }
        : { icone: <ShieldCheck className="w-7 h-7" />, titulo: "Ainda não conseguimos confirmar", texto: "Sua compra está registrada na Apple e você não será cobrado de novo. Toque em Restaurar compras em instantes ou fale com o suporte da VANT.", cor: GOLD };
    case "falhou": {
      const m: Record<string, [string, string]> = {
        sem_internet: ["Sem internet", "Nada foi cobrado. Verifique sua conexão e tente de novo."],
        produto_indisponivel: ["Plano indisponível agora", "Nada foi cobrado. Tente de novo em instantes."],
        compra_nao_permitida: ["Compras desativadas neste iPhone", "Ative as compras em Ajustes > Tempo de Uso e tente de novo."],
        sem_sessao: ["Entre na sua conta", "Entre na sua conta VANT para assinar."],
        nao_ofertado: ["Plano indisponível para esta conta", "Sua conta já tem um plano em andamento."],
      };
      const [titulo, texto] = m[r.motivo] ?? ["A App Store não respondeu", "Nada foi cobrado. Tente de novo em instantes."];
      return { icone: <AlertTriangle className="w-7 h-7" />, titulo, texto, cor: "#ff7d6b" };
    }
    default:
      return { icone: null, titulo: "", texto: "", cor: GOLD };
  }
}

/** Takes the place of the plans after a purchase attempt ended in something to say: one calm,
    full-height message with its single next step. */
export function EstadoDaCompra({ resultado, ocupado, onTentarDeNovo, onContinuar, onVoltar }: {
  resultado: ResultadoCompra; ocupado?: boolean; onTentarDeNovo: () => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const t = textoDoEstado(resultado);
  const sucesso = resultado.estado === "liberada";
  const botao = "w-full h-[56px] rounded-[18px] text-[16px] font-black disabled:opacity-60";
  return (
    <div role="status" className="min-h-[70dvh] flex flex-col items-center justify-center text-center text-[#F4F1EA] px-1">
      <span className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center"
        style={{ background: sucesso ? "radial-gradient(circle,rgba(73,217,138,.22),rgba(73,217,138,.04))" : "rgba(255,255,255,.05)", color: t.cor, border: `1px solid ${sucesso ? "rgba(73,217,138,.35)" : "rgba(255,255,255,.08)"}` }}>
        {t.icone}
        {ocupado && <span aria-hidden className="absolute inset-[-6px] rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: GOLD }} />}
      </span>
      <p className="text-[clamp(22px,6.4vw,26px)] font-black mt-6 leading-tight tracking-[-.02em]">{t.titulo}</p>
      <p className="text-[14px] mt-2.5 leading-snug max-w-[320px]" style={{ color: "#a9a397" }}>{t.texto}</p>
      <div className="mt-8 w-full max-w-[360px] space-y-2.5">
        {sucesso && <button type="button" onClick={onContinuar} className={botao} style={{ background: "linear-gradient(180deg,#FFE58A 0%,#F5B800 58%,#D9A000 100%)", color: "#1A1200" }}>Continuar</button>}
        {resultado.estado === "aguardando_servidor" && (
          <button type="button" onClick={onTentarDeNovo} disabled={ocupado} className={botao} style={{ background: GOLD, color: "#1A1200" }}>{ocupado ? "Confirmando..." : "Tentar de novo"}</button>
        )}
        {!sucesso && (
          <button type="button" onClick={onVoltar} className={botao} style={{ background: "transparent", border: "1px solid #2a2823", color: "#b9b3a6" }}>
            {resultado.estado === "falhou" || resultado.estado === "recusada" ? "Voltar aos planos" : "Fechar"}
          </button>
        )}
      </div>
    </div>
  );
}
