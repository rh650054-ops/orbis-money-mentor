import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({ supabase: {}, createQueryKeys: () => ({ byUser: (u: string) => ["conta", u] }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, signOut: vi.fn() }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/shared/hooks/use-brazil-cities", () => ({ useBrazilCities: () => ({ cities: ["Cotia"], loading: false }) }));
vi.mock("@/components/PublicProfileModal", () => ({ default: () => null }));
vi.mock("@/components/AvatarCropper", () => ({ AvatarCropper: () => null }));
vi.mock("../api/use-conta-query", () => ({
  useContaQuery: () => ({
    isLoading: false, isError: false,
    data: {
      conta: {
        user_id: "u1", nickname: "Rick", email: "rick@vant.com", phone: "11987654321", city: "Cotia", state: "SP",
        avatar_url: "/avatares/raio.svg", created_at: "2026-06-16T00:00:00Z", plan_status: "active", trial_end: null,
        is_demo: false, billing_exempt: false, comp_label: null, bio: "Batidas no farol", what_i_sell: "Batidas", where_i_sell: "Cotia",
        instagram: "vant", whatsapp_public: null, show_instagram: true, show_whatsapp: false, show_city: true, ranking_oculto: false,
      },
      pro: { pro: true, origem: "hotmart", ate: "2026-11-01" },
    },
  }),
}));
vi.mock("../api/use-atividade-query", () => ({
  useAtividadeQuery: () => ({ isLoading: false, data: { vendas: 197, abordagens: 365, diasAtivos: 12, faturamento: 4000 } }),
}));
const { mutacao } = vi.hoisted(() => ({ mutacao: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../api/use-conta-mutations", () => ({ useSalvarDadosMutation: mutacao, useSalvarPerfilMutation: mutacao, useRankingVisivelMutation: mutacao }));
vi.mock("../api/use-foto-mutation", () => ({ useFotoMutation: mutacao }));

import ContaPage from "./conta-page";

describe("minha conta", () => {
  it("separates public profile, activity, private data, plan and privacy", () => {
    render(<MemoryRouter><ContaPage /></MemoryRouter>);
    // card: name + plan badge, no phone/e-mail up top
    expect(screen.getAllByText("Rick").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PRO").length).toBeGreaterThan(0);
    for (const t of ["SEU PERFIL PÚBLICO", "SUA ATIVIDADE", "DADOS DA CONTA", "SEU PLANO", "PRIVACIDADE E VISIBILIDADE"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText("197")).toBeTruthy();
    expect(screen.getByText("54%")).toBeTruthy();
    expect(screen.getByText("@vant")).toBeTruthy();
    expect(screen.getByText("VANT PRO")).toBeTruthy();

    // deleting needs a sheet + typing EXCLUIR
    fireEvent.click(screen.getByText("Excluir conta"));
    const botao = screen.getByText("Excluir de vez").closest("button")!;
    expect(botao.hasAttribute("disabled")).toBe(true);
  });
});
