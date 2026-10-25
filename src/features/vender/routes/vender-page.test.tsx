import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({ supabase: {}, createQueryKeys: (f: string) => ({ all: [f], byUser: (u: string) => [f, u] }) }));
vi.mock("@/features/renovacao", () => ({ AvisoRenovacaoPix: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "r@v.com" } }) }));
vi.mock("@/components/ranking/AvatarRanking", () => ({ SeloVerificado: () => null }));
vi.mock("@/components/conectar/PapelContas", () => ({ BancoExtra: () => null, avisoPapel: () => true }));
vi.mock("@/components/conectar/comprovante-renda", () => ({ gerarComprovante: vi.fn(), baixarComprovantePDF: vi.fn() }));
vi.mock("../api/use-leitura-ao-abrir", () => ({ useLeituraAoAbrir: () => undefined }));
vi.mock("../api/use-ligar-banco", () => ({ useLigarBanco: () => ({ ligar: vi.fn(), ligando: false, precisaExtra: false, fecharExtra: vi.fn() }) }));
const { mutacao } = vi.hoisted(() => ({ mutacao: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }));
vi.mock("../api/use-vender-mutations", () => ({ useAtualizarAgoraMutation: mutacao, usePapelMutation: mutacao, useDesligarMutation: mutacao }));
vi.mock("../api/use-bancos-query", () => ({
  useBancosQuery: () => ({
    isLoading: false,
    data: {
      pro: { pro: true, origem: "hotmart", ate: null, bancos: 2, verificado: true },
      bancos: [
        { id: "b1", item_id: "i1", institution_name: "InfinitePay", institution_logo: null, status: "UPDATED", last_synced_at: new Date().toISOString(), papel: "trabalho" },
        { id: "b2", item_id: "i2", institution_name: "Nubank", institution_logo: null, status: "UPDATED", last_synced_at: new Date().toISOString(), papel: null },
      ],
      contas: [{ id: "b1", papel: "trabalho" }, { id: "b2", papel: null }],
      cobraPix: false,
    },
  }),
}));
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
vi.mock("../api/use-conciliacao-query", () => ({
  useConciliacaoQuery: () => ({
    data: { hoje, tem_banco: true, ultima_leitura: new Date().toISOString(),
      dias: [{ dia: hoje, fez: 1092, dinheiro: 0, caiu: 960, depois: 0, pessoal: 0, qtd: 14, conferido: false }] },
  }),
}));

import VenderPage from "./vender-page";

describe("vender", () => {
  it("shows the day's reconciliation, the 7 days, the banks and what is missing", () => {
    render(<MemoryRouter><VenderPage /></MemoryRouter>);
    expect(screen.getByText("CONCILIADO HOJE")).toBeTruthy();
    expect(screen.getByText("Faltam R$ 132 pra conciliar")).toBeTruthy();
    expect(screen.getByText(/Lido às/)).toBeTruthy();
    for (const t of ["VOCÊ FEZ × CAIU · 7 DIAS", "COMPROVANTE DE RENDA", "ONDE VOCÊ RECEBE"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getAllByText("ATIVO")).toHaveLength(2);
    expect(screen.getByText("1 conta sem classificação")).toBeTruthy();
  });
});
