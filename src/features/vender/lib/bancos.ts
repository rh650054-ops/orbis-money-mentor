/* Every connected bank always shows one of three statuses (no more silent rows). */
import { saudeDoBanco, horaBR } from "@/components/conectar/pluggy";
import type { Tom } from "@/shared/components/vant-status";

export type StatusBanco = { rotulo: "ATIVO" | "ATENÇÃO" | "DESCONECTADO"; tom: Tom; detalhe: string; autorizar: boolean };

const DIA_MS = 26 * 60 * 60_000;

export function statusDoBanco(status: string | null, ultimaSync: string | null, agora = Date.now()): StatusBanco {
  const s = saudeDoBanco(status, ultimaSync);
  if ("autorizar" in s && s.autorizar) return { rotulo: "DESCONECTADO", tom: "erro", detalhe: "autorize de novo no app do banco", autorizar: true };
  if (s.alerta) return { rotulo: "ATENÇÃO", tom: "atencao", detalhe: s.texto, autorizar: false };
  if (!ultimaSync) return { rotulo: "ATENÇÃO", tom: "atencao", detalhe: "aguardando a primeira leitura", autorizar: false };
  if (agora - Date.parse(ultimaSync) > DIA_MS) return { rotulo: "ATENÇÃO", tom: "atencao", detalhe: `sem leitura desde ${new Date(ultimaSync).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}`, autorizar: false };
  const lendo = String(status ?? "").toUpperCase() === "UPDATING";
  return { rotulo: "ATIVO", tom: "ok", detalhe: lendo ? "lendo agora…" : `conferido ${horaBR(ultimaSync)}`, autorizar: false };
}

export function papelTexto(papel: string | null | undefined): string {
  if (papel === "trabalho") return "Trabalho";
  if (papel === "pessoal") return "Pessoal";
  return "Falta classificar";
}
