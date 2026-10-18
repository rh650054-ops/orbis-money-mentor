/* Extra hints under the hero, only when something is missing (state 5:
   the money may be in an account marked personal or in a bank needing attention). */
import type { BancoLigado } from "@/components/conectar/pluggy";
import type { DiaConc } from "../types";
import { falta } from "./conciliacao";
import { reais } from "./textos";

export function dicasDoDia(d: DiaConc, _bancos: BancoLigado[]): string[] {
  if (falta(d) < 1) return [];
  const out: string[] = [];
  if (d.pessoal >= 1) out.push(`${reais(d.pessoal)} caíram numa conta Pessoal. Se era venda, mude pra Trabalho.`);
  return out;
}
