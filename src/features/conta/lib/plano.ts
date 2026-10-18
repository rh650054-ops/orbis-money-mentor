/* Which plan the vendor is on, in words the screen shows. */
import type { Conta, ProStatus } from "../types";

export type Plano = {
  /** Short badge next to the name. */
  selo: string;
  /** Big title in "Seu plano". */
  nome: string;
  status: "ativo" | "teste" | "cortesia" | "sem";
  /** Extra line: renewal / trial end. */
  detalhe: string | null;
  /** Subscribers manage on Hotmart; everyone else goes to /planos. */
  assinante: boolean;
};

const dataBR = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function planoDe(c: Pick<Conta, "plan_status" | "trial_end" | "is_demo" | "billing_exempt" | "comp_label">, pro: ProStatus | null | undefined): Plano {
  const ativo = c.plan_status === "active";
  if (c.billing_exempt) {
    return { selo: pro?.pro ? "PRO" : "BLACK", nome: c.comp_label ? `VANT · ${c.comp_label}` : "VANT BLACK", status: "cortesia", detalhe: "Acesso liberado pela VANT", assinante: false };
  }
  if (pro?.pro) {
    const ate = dataBR(pro.ate);
    return { selo: "PRO", nome: "VANT PRO", status: "ativo", detalhe: ate ? `Renova em ${ate}` : null, assinante: true };
  }
  if (ativo) return { selo: "ESSENCIAL", nome: "VANT ESSENCIAL", status: "ativo", detalhe: null, assinante: true };
  if (c.plan_status === "trial") {
    const fim = dataBR(c.trial_end);
    return { selo: "TESTE", nome: "Teste grátis", status: "teste", detalhe: fim ? `Termina em ${fim}` : null, assinante: false };
  }
  return { selo: "", nome: "Sem plano ativo", status: "sem", detalhe: "Assine pra voltar a usar tudo", assinante: false };
}

/** "Membro desde outubro de 2026". */
export function membroDesde(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
