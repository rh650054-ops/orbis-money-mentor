/* 29/10 (Rick): the VANT never asks for data — it shows what it can't tell without it. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
let fonte: "receita" | "sem_custo" = "sem_custo";
vi.mock("../api/use-sobrar-mes", () => ({
  useSobrarMesQuery: () => ({ data: { hoje: "2026-11-05", vendas_mes: 7000, unidades_mes: 700, dias_mes: 12, lucro_unid: 6.2, lucro_mes: 4100, ticket: 10, fonte_custo: fonte, produto_nome: "Batida", custo_corre_dia: 0, calote_pct: 6, calote_unid: 0.6, missao: null } }),
}));
const salvar = vi.fn();
vi.mock("@/features/produtos", async (orig) => ({
  ...(await orig<typeof import("@/features/produtos")>()),
  useProdutosQuery: () => ({ data: [] }),
}));
vi.mock("@/features/produtos/api/use-custo-rapido-mutation", () => ({
  useCustoRapidoMutation: () => ({ isPending: false, mutate: (r: unknown, o: { onSuccess: () => void }) => { salvar(r); o.onSuccess(); } }),
}));
import { SobrouHoje } from "./sobrou-hoje";

const montar = () => render(<QueryClientProvider client={new QueryClient()}><SobrouHoje userId="u1" vendido={1020} precoSugerido={10} dia="2026-11-05" /></QueryClientProvider>);

describe("Sobrou pra você (fim do DEFCON)", () => {
  beforeEach(() => { localStorage.clear(); salvar.mockReset(); fonte = "sem_custo"; });

  it("sem custo: pergunta 'quanto é seu?' e salva o produto com o cadastro de 1 minuto", async () => {
    montar();
    expect(screen.getByText(/Quanto disso é seu\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trufa" }));
    fireEvent.click(screen.getByRole("button", { name: "R$ 3" }));
    expect(screen.getByText(/R\$ 7,00/)).toBeTruthy(); // 10 − 3 por trufa
    fireEvent.click(screen.getByRole("button", { name: /Salvar e ver quanto sobrou/ }));
    expect(salvar).toHaveBeenCalledWith({ produtoId: undefined, nome: "Trufa", preco: 10, custo: 3 });
    // 1020 × (7 − 0,6 calote) / 10 = 652,8
    await waitFor(() => expect(screen.getByText(/≈ R\$ 653/)).toBeTruthy());
  });

  it("'Amanhã' guarda por dia e deixa só o convite", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Amanhã" }));
    expect(screen.queryByRole("button", { name: /Salvar e ver/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Descobrir em 1 minuto/ })).toBeTruthy();
    expect(localStorage.getItem("vant_sobrou_depois_2026-11-05")).toBe("1");
  });

  it("com custo conhecido mostra o que sobrou, sem pedir nada", () => {
    fonte = "receita";
    montar();
    expect(screen.getByText(/≈ R\$ 632/)).toBeTruthy(); // 1020 × 6,2/10
    expect(screen.queryByText(/Quanto disso é seu/)).toBeNull();
  });
});
