/* Extra hints under the hero, only when something is missing (state 5:
   the money may be in an account marked personal or in a bank needing attention). */
import type { BancoLigado } from "@/components/conectar/pluggy";
import type { DiaConc } from "../types";
import { falta } from "./conciliacao";
import { statusDoBanco } from "./bancos";
import { reais } from "./textos";

export function dicasDoDia(d: DiaConc, bancos: BancoLigado[]): string[] {
  if (falta(d) < 1) return [];
  const out: string[] = [];
  if (d.pessoal >= 1) out.push(`${reais(d.pessoal)} caíram numa conta marcada como pessoal. Se era venda, mude ela pra Trabalho.`);
  const ruim = bancos.find((b) => statusDoBanco(b.status, b.last_synced_at).rotulo !== "ATIVO");
  if (ruim) out.push(`O ${ruim.institution_name ?? "banco"} precisa de atenção: o que caiu nele pode estar fora da conciliação.`);
  return out;
}
