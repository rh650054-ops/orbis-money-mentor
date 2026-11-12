// A-PR3 — the state rules exist twice: here (app and edge functions) and in SQL (the of_* functions
// that calculate the new states in parallel). One list of cases is run by both suites, so a rule
// changed in one place fails the other: supabase/modulo-a/estados-casos.json
// (SQL side: supabase/tests/casos/14_modulo_a_estados.sql).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acaoDoVendedor, consentimentoDoItem, grupoDoStatus, STATUS_CONHECIDOS,
} from "../../supabase/functions/_shared/pluggy-estado";

type CasoDeGrupo = { status: string | null; grupo: string };
type CasoDeConsentimento = {
  nome: string; status: string | null; execucao: string | null; erro: string | null;
  expira: string | null; quando: string; consentimento: string; pede_vendedor: boolean;
};
const casos = JSON.parse(readFileSync(join(process.cwd(), "supabase/modulo-a/estados-casos.json"), "utf8")) as {
  grupos: CasoDeGrupo[]; consentimentos: CasoDeConsentimento[];
};

describe("A-PR3 — one list of cases for the two implementations of the state rules", () => {
  it("has the cases (a list emptied by mistake would pass everything)", () => {
    expect(casos.grupos.length).toBeGreaterThanOrEqual(20);
    expect(casos.consentimentos.length).toBeGreaterThanOrEqual(30);
  });
  it("every stored status falls in the group the list says", () => {
    for (const c of casos.grupos) expect([c.status, grupoDoStatus(c.status)]).toEqual([c.status, c.grupo]);
  });
  it("every status this code knows is in the list", () => {
    const naLista = new Set(casos.grupos.map((c) => String(c.status ?? "").trim().toUpperCase()));
    for (const s of STATUS_CONHECIDOS) expect(naLista.has(s.toUpperCase())).toBe(true);
  });
  it("every consulted state gives the consent the list says, and asks the vendor exactly when it says", () => {
    for (const c of casos.consentimentos) {
      const item = { status: c.status, executionStatus: c.execucao, error: c.erro ? { code: c.erro } : null, consentExpiresAt: c.expira };
      const consentimento = consentimentoDoItem(item, new Date(c.quando));
      expect([c.nome, consentimento]).toEqual([c.nome, c.consentimento]);
      expect([c.nome, acaoDoVendedor(consentimento) === "reautorizar"]).toEqual([c.nome, c.pede_vendedor]);
    }
  });
  it("covers every consent state of the contract", () => {
    const vistos = new Set(casos.consentimentos.map((c) => c.consentimento));
    for (const estado of ["autorizado", "expirando", "aguardando_vendedor", "credencial_invalida", "expirado", "revogado", "nao_informado", "desconhecido"]) {
      expect(vistos.has(estado)).toBe(true);
    }
  });
});
