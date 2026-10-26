import { describe, expect, it, vi } from "vitest";

const chamadas: string[] = [];
vi.mock("@/shared/api", () => ({
  supabase: { rpc: (fn: string) => { chamadas.push(fn); return Promise.resolve({ data: null, error: null }); } },
}));
import { salvarReceita } from "./salvar-receita";

describe("salvarReceita", () => {
  it("converte a compra (un → g) antes da receita e acerta os ingredientes novos depois", async () => {
    await salvarReceita("p1", [{ nome: "Nutella", qtd: 30, preco: 0.078, unidade: "g", pacote: 650 }], 6);
    expect(chamadas).toEqual(["ingredientes_definir_compra", "produto_salvar_receita", "ingredientes_definir_compra"]);
  });
});
