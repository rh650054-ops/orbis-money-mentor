import { describe, expect, it } from "vitest";
import { copiasRepetidas, type Conexao } from "../../supabase/functions/_shared/pluggy-duplicadas";

const agora = Date.parse("2026-11-04T12:00:00Z");
const c = (id: string, user: string, criada: string, banco = "Mercado Pago", dono = "Joao"): Conexao =>
  ({ id, user_id: user, institution_name: banco, dono_nome: dono, created_at: criada });

describe("copiasRepetidas", () => {
  it("keeps the oldest and removes the copies of the same account", () => {
    const cons = [c("b", "u1", "2026-11-03T18:44:38Z"), c("a", "u1", "2026-11-03T18:44:25Z"), c("c", "u1", "2026-11-03T18:44:50Z")];
    const contas = new Map([["a", ["DHDCF"]], ["b", ["DHDCF"]], ["c", ["DHDCF"]]]);
    expect(copiasRepetidas(cons, contas, agora).sort()).toEqual(["b", "c"]);
  });
  it("two different accounts of the same bank both stay", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-03T11:00:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["GUJO"]], ["b", ["DHDCF"]]]), agora)).toEqual([]);
  });
  it("different vendors are never mixed", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u2", "2026-11-03T11:00:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
  });
  it("leaves alone a connection made in the last 10 minutes or without accounts yet", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-04T11:55:00Z"), c("d", "u1", "2026-11-03T10:05:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
  });
});
