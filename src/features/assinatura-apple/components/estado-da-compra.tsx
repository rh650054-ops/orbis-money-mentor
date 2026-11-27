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
      const porque = r.motivo === "sem_internet" ? "Você está sem internet." : r.motivo === "sessao" ? "Entre de novo na sua conta VANT." : "Nosso servidor não respondeu agora.";
      return { icone: r.motivo === "sem_internet" ? <WifiOff className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />, titulo: "Pagamento recebido", texto: `${porque} Sua compra está guardada e o acesso libera assim que confirmarmos. Você não será cobrado de novo.`, cor: GOLD };
    }
    case "de_outra_conta":
      return { icone: <AlertTriangle className="w-7 h-7" />, titulo: "Compra de outra conta VANT", texto: "A compra da Apple neste iPhone foi feita para outra conta VANT. Entre na conta que fez a compra para liberar o acesso.", cor: GOLD };
    case "recusada":
      return r.motivo === "reembolsada"
        ? { icone: <AlertTriangle className="w-7 h-7" />, titulo: "Esta compra foi reembolsada", texto: "A Apple devolveu o valor desta compra, então ela não libera acesso. Você pode assinar de novo quando quiser.", cor: "#ff7d6b" }
        : { icone: <AlertTriangle className="w-7 h-7" />, titulo: "Não foi possível confirmar a compra", texto: "Fale com o suporte da VANT: sua compra na Apple está registrada e vamos resolver.", cor: "#ff7d6b" };
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

/** The card that takes the place of the plans after a purchase attempt ended in something to say. */
export function EstadoDaCompra({ resultado, ocupado, onTentarDeNovo, onContinuar, onVoltar }: {
  resultado: ResultadoCompra; ocupado?: boolean; onTentarDeNovo: () => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const t = textoDoEstado(resultado);
  const botao = "w-full h-[52px] rounded-[16px] text-[15px] font-black disabled:opacity-60";
  return (
    <div role="status" className="rounded-[22px] border px-5 py-7 text-center" style={{ background: "#0b0b0d", borderColor: "#26241f" }}>
      <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.05)", color: t.cor }}>{t.icone}</span>
      <p className="text-[20px] font-black mt-4 leading-tight">{t.titulo}</p>
      <p className="text-[13.5px] mt-2 leading-snug" style={{ color: "#b9b3a6" }}>{t.texto}</p>
      <div className="mt-6 space-y-2.5">
        {resultado.estado === "liberada" && <button type="button" onClick={onContinuar} className={botao} style={{ background: GOLD, color: "#1A1200" }}>Continuar</button>}
        {resultado.estado === "aguardando_servidor" && (
          <button type="button" onClick={onTentarDeNovo} disabled={ocupado} className={botao} style={{ background: GOLD, color: "#1A1200" }}>{ocupado ? "Verificando..." : "Tentar de novo"}</button>
        )}
        {resultado.estado !== "liberada" && (
          <button type="button" onClick={onVoltar} className={botao} style={{ background: "transparent", border: "1px solid #2a2823", color: "#b9b3a6" }}>
            {resultado.estado === "falhou" || resultado.estado === "recusada" ? "Voltar aos planos" : "Fechar"}
          </button>
        )}
      </div>
    </div>
  );
}
