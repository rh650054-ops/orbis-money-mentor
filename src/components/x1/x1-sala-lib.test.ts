import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { criarSala, ordenarPlacar, type SalaLutador } from "./x1-sala-lib";
import { lutar, pontosDoDuelo, PONTOS_X1 } from "./x1-lib";

const lut = (id: string, total: number, status: SalaLutador["status"] = "dentro"): SalaLutador => ({
  user_id: id, status, nome: id, avatar: null, patente: "NOVATO", total, posicao: null, convidado_por: null,
});

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: "id", error: null }); });

describe("X1 só pontos: o app nunca manda aposta", () => {
  it("desafio 1×1 vai sempre com p_stakes 0", async () => {
    await lutar("ele");
    expect(rpc).toHaveBeenCalledWith("x1_lutar", { p_opponent: "ele", p_stakes: 0 });
  });
  it("sala nova vai sempre com p_stakes 0", async () => {
    await criarSala({ nome: "Sala", vagas: 4, convidados: ["a"] });
    expect(rpc).toHaveBeenCalledWith("x1_sala_criar", { p_nome: "Sala", p_stakes: 0, p_vagas: 4, p_convidados: ["a"] });
  });
  it("erro do servidor (x1_so_pontos) vira frase pro vendedor", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x1_so_pontos: o X1 agora vale só pontos" } });
    await expect(criarSala({ nome: "S", vagas: 2, convidados: [] })).rejects.toThrow("o X1 agora vale só pontos");
  });
});

describe("pontos do duelo (mesma regra do x1_recorde)", () => {
  it("vitória dá 10; derrota, empate, cancelado e em andamento dão 0", () => {
    expect(pontosDoDuelo({ status: "finished", winner_user_id: "eu" }, "eu")).toBe(PONTOS_X1.vitoria);
    expect(pontosDoDuelo({ status: "finished", winner_user_id: "ele" }, "eu")).toBe(0);
    expect(pontosDoDuelo({ status: "finished", winner_user_id: null }, "eu")).toBe(0);
    expect(pontosDoDuelo({ status: "cancelled", winner_user_id: null }, "eu")).toBe(0);
    expect(pontosDoDuelo({ status: "active", winner_user_id: "eu" }, "eu")).toBe(0);
  });
  it("ninguém perde ponto (não é aposta)", () => {
    expect(Object.values(PONTOS_X1).every((v) => v >= 0)).toBe(true);
  });
});

describe("ordenarPlacar", () => {
  it("orders by total, ties share the position, ignores who is not in", () => {
    const r = ordenarPlacar([lut("a", 300), lut("b", 640), lut("c", 300), lut("d", 999, "convidado"), lut("e", 0)]);
    expect(r.map((x) => [x.user_id, x.pos])).toEqual([["b", 1], ["a", 2], ["c", 2], ["e", 4]]);
  });
  it("closed room: the position saved by the database wins", () => {
    const fechado = (id: string, total: number, posicao: number): SalaLutador => ({ ...lut(id, total), posicao });
    const r = ordenarPlacar([fechado("a", 500, 1), fechado("b", 500, 1), fechado("c", 100, 3)]);
    expect(r.map((x) => [x.user_id, x.pos])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
  });
});
