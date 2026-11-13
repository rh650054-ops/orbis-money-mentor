// The webhook's AUTO-CURA: Pluggy tells us about an Item that has no connection here, but whose
// clientUserId (stamped by our connect token) is a Pro seller. The webhook then creates the
// connection on its own. This file is that decision, kept apart from Deno so it can be tested.
//
// 12/11/2026 (A2): the slot check has three answers. Only a limit that is KNOWN and exceeded
// ("sem_vaga") deletes the Item on Pluggy. When the limit could not be checked ("indisponivel")
// nothing is created and nothing is deleted: Pluggy's next event for the same Item tries again.
// 13/11/2026: the same for the plan. A plan that could not be read is asked once more and, with
// no answer, nothing is created ("plano_indisponivel"); it is no longer read as "has no plan".

import { statusParaGravar } from "../_shared/pluggy-estado.ts";
import { planoAtivo } from "../_shared/pluggy-plano.ts";

export type Vaga = "cabe" | "sem_vaga" | "indisponivel";

export type ItemDaCura = {
  status?: string | null;
  executionStatus?: string | null;
  error?: { code?: string | null } | null;
  connector?: { name?: string | null; imageUrl?: string | null } | null;
};

/** The connection as the rest of the webhook uses it. */
export type Curada = { id: string; user_id: string; institution_name: string | null };

export type LinhaDaCura = {
  user_id: string; item_id: string; institution_name: string; institution_logo: string | null;
  status: string; updated_at: string;
};

export type Recusa = "sem_dono" | "sem_pro" | "plano_indisponivel" | "sem_vaga" | "limite_indisponivel" | "nao_gravou";

export interface PortasDaCura {
  /** undefined (or a throw) when the plan could not be read. */
  ehPro(dono: string): Promise<boolean | undefined>;
  vaga(dono: string, banco: string, itemId: string): Promise<Vaga>;
  apagarNaPluggy(itemId: string): Promise<void>;
  /** null when the row was not saved. */
  gravar(linha: LinhaDaCura): Promise<Curada | null>;
  agora(): Date;
  registrar(msg: string, ...detalhes: unknown[]): void;
}

export async function autoCura(
  p: PortasDaCura, c: { itemId: string; item: ItemDaCura | null | undefined; dono: string }, esperaMs = 300,
): Promise<{ con: Curada } | { recusa: Recusa }> {
  if (!c.item || !c.dono) {
    p.registrar("pluggy-webhook: item sem conexao e sem dono", c.itemId);
    return { recusa: "sem_dono" };
  }
  const plano = await planoAtivo(() => p.ehPro(c.dono), esperaMs);
  if (plano === "indisponivel") {
    p.registrar("pluggy-webhook: plano indisponivel, conexao nao criada agora", c.dono);
    return { recusa: "plano_indisponivel" };
  }
  if (plano === "nao") {
    p.registrar("pluggy-webhook: dono sem Pro, nao cria conexao", c.dono);
    return { recusa: "sem_pro" };
  }
  // every connection takes a slot of the plan (Pro monthly = 1 bank)
  const banco = String(c.item.connector?.name ?? "Banco");
  const vaga = await p.vaga(c.dono, banco, c.itemId);
  if (vaga === "sem_vaga") {
    await p.apagarNaPluggy(c.itemId);
    p.registrar("pluggy-webhook: banco a mais sem vaga no plano, item apagado", c.itemId, c.dono);
    return { recusa: "sem_vaga" };
  }
  if (vaga !== "cabe") {
    p.registrar("pluggy-webhook: limite indisponivel, conexao nao criada e item mantido", c.itemId, c.dono);
    return { recusa: "limite_indisponivel" };
  }
  const con = await p.gravar({
    user_id: c.dono,
    item_id: c.itemId,
    institution_name: banco,
    institution_logo: c.item.connector?.imageUrl ?? null,
    status: statusParaGravar(c.item) || "UPDATING", // A3: the seller's pending action is not lost
    updated_at: p.agora().toISOString(),
  });
  if (!con) return { recusa: "nao_gravou" };
  p.registrar("pluggy-webhook: conexao criada pela auto-cura", c.itemId, c.dono);
  // A4: nothing is deleted because of the bank's name (pluggy-vaga.ts)
  return { con };
}
