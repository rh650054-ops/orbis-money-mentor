import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({ supabase: {}, createQueryKeys: (f: string) => ({ all: [f], byUser: (u: string) => [f, u] }) }));
vi.mock("@/features/renovacao", () => ({ AvisoRenovacaoPix: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "r@v.com" } }) }));
vi.mock("@/hooks/useCheckoutUrl", () => ({ useCheckoutUrl: () => (u: string) => u }));
vi.mock("@/hooks/useVoltaDoCheckout", () => ({ useVoltaDoCheckout: () => undefined }));
const { sub, abrir } = vi.hoisted(() => ({ sub: { subscribed: true, status: "trial", graceUntil: "2999-01-01" }, abrir: vi.fn() }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ status: sub, loading: false }) }));
vi.mock("@/shared/lib/checkout", async (orig) => ({ ...(await orig<typeof import("@/shared/lib/checkout")>()), abrirCheckout: abrir }));
vi.mock("@/components/ranking/AvatarRanking", () => ({ SeloVerificado: () => null }));
vi.mock("@/components/conectar/PapelContas", () => ({ BancoExtra: () => null, avisoPapel: () => true }));
vi.mock("../api/use-leitura-ao-abrir", () => ({ useLeituraAoAbrir: () => undefined }));
vi.mock("../api/use-ligar-banco", () => ({ useLigarBanco: () => ({ ligar: vi.fn(), ligando: false, precisaExtra: false, fecharExtra: vi.fn() }) }));
const { mutacao } = vi.hoisted(() => ({ mutacao: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) }));
vi.mock("../api/use-vender-mutations", () => ({ useAtualizarAgoraMutation: mutacao, usePapelMutation: mutacao, useDesligarMutation: mutacao }));
vi.mock("../api/use-bancos-query", () => ({
  useBancosQuery: () => ({ isLoading: false, refetch: vi.fn(), data: { pro: { pro: false, liberado: false, origem: null, ate: null, bancos: 0, verificado: false }, bancos: [], contas: [], cobraPix: false } }),
}));
vi.mock("../api/use-conciliacao-query", () => ({
  useConciliacaoQuery: () => ({ data: { hoje: "2026-10-25", tem_banco: false, ultima_leitura: null, dias: [{ dia: "2026-10-25", fez: 912, dinheiro: 0, caiu: null, depois: 0, pessoal: 0, qtd: 9, conferido: false }] } }),
}));

import VenderPage from "./vender-page";

describe("vender · Pro showcase for whoever is not Pro (25/10/2026)", () => {
  it("trial: shows the 3 plans, the annual open by default, and opens that plan's checkout", () => {
    render(<MemoryRouter><VenderPage /></MemoryRouter>);
    expect(screen.getByText("R$ 912")).toBeTruthy(); // the vendor's own last 3 days
    for (const t of ["Essencial", "Pro Anual", "Pro Mensal", "Contas em Dia", "Ranking de hoje"]) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText(/MAIS ESCOLHIDO/)).toBeTruthy();
    fireEvent.click(screen.getByText("QUERO O ANUAL COM O TIME VANT"));
    expect(abrir.mock.calls[0]?.[0]).toContain("off=ew11enu0");
    fireEvent.click(screen.getByText("Pro Mensal"));
    fireEvent.click(screen.getByText("QUERO O PRO MENSAL"));
    expect(abrir.mock.calls[1]?.[0]).toContain("off=5y86n311");
    expect(screen.queryByText("CONECTAR MEU BANCO")).toBeNull();
  });

  it("Essencial subscriber: upgrade only, the Essencial marked as their plan", () => {
    sub.status = "active";
    render(<MemoryRouter><VenderPage /></MemoryRouter>);
    expect(screen.getByText("SEU PLANO")).toBeTruthy();
    expect(screen.getByText("Suba pro Pro")).toBeTruthy();
    expect(screen.queryByText("COMEÇAR COM O ESSENCIAL")).toBeNull();
  });
});
