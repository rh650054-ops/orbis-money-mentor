import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bloqueioIa, iaPermitida, iaPermitidaPara, VERSAO_DIVULGACAO_IA } from "@/shared/lib/consentimento-ia";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const bd = vi.hoisted(() => ({ linha: null as { permitido: boolean; versao?: string } | null, upsert: vi.fn(), termos: "2026-11-26", lidas: 0 }));
vi.mock("@/shared/api", async () => {
  const { createQueryKeys } = await import("@/shared/api/query-keys");
  return {
    createQueryKeys,
    supabase: {
      from: (t: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => {
          if (t !== "profiles") bd.lidas += 1;
          return { data: t === "profiles" ? { termos_aceitos_versao: bd.termos } : bd.linha, error: null };
        } }) }),
      }),
      rpc: async (fn: string, a: { p_permitido: boolean; p_versao: string }) => { bd.upsert({ fn, ...a }); bd.linha = { permitido: a.p_permitido, versao: a.p_versao }; return { error: null }; },
    },
  };
});
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));
import { ConsentimentoIaGate } from "./components/consentimento-ia-gate";

const montar = (rota = "/") => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[rota]}><ConsentimentoIaGate /></MemoryRouter>
  </QueryClientProvider>,
);

describe("consentimento de IA", () => {
  beforeEach(() => { bd.linha = null; bd.termos = "2026-11-26"; bd.lidas = 0; bd.upsert.mockReset(); });

  it("quem ainda não respondeu vê a pergunta; Permitir salva e libera a IA", async () => {
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(screen.getAllByText(/Anthropic \(Claude\)/).length).toBeGreaterThan(0);
    expect(screen.getByText("OpenAI (ChatGPT)")).toBeInTheDocument();
    // two providers only (26/11): nothing on screen names Google, Gemini or Cerebras
    expect(screen.queryByText(/Google|Gemini|Cerebras/)).not.toBeInTheDocument();
    expect(screen.getByText("Comprovante do X1")).toBeInTheDocument();
    expect(screen.getByText("Importar histórico")).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
    fireEvent.click(screen.getByText("Permitir"));
    await waitFor(() => expect(bd.upsert).toHaveBeenCalledWith(expect.objectContaining({ fn: "responder_consentimento_ia", p_permitido: true, p_versao: VERSAO_DIVULGACAO_IA })));
    await waitFor(() => expect(iaPermitida()).toBe(true));
  });

  it("com os Termos desatualizados não abre: a tela dos Termos pergunta as duas coisas juntas", async () => {
    bd.termos = "2026-07-28";
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });

  it("nunca abre por cima do onboarding (roubava o foco e o teclado do iPhone piscava)", async () => {
    montar("/onboarding-novo");
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });

  it("autorização dada no texto de 26/11 (Missão e DEFCON sem a Anthropic) não vale: pergunta de novo", async () => {
    bd.linha = { permitido: true, versao: "2026-11-26" };
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
  });

  // 2026-11-28 only removed recipients from what 2026-11-27 listed: nobody is asked again for that
  it("quem autorizou o texto de 27/11 não vê pergunta nenhuma e a IA segue ligada", async () => {
    bd.linha = { permitido: true, versao: "2026-11-27" };
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(true));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
    // …but a feature that only the current text lists stays closed until they allow it
    expect(iaPermitidaPara("import-financial-pdf")).toBe(false);
    expect(iaPermitidaPara("bright-action")).toBe(true);
  });

  it("quem recusou no texto de 27/11 continua recusado, sem pergunta de novo", async () => {
    bd.linha = { permitido: false, versao: "2026-11-27" };
    montar();
    await waitFor(() => expect(bd.lidas).toBeGreaterThan(0));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
  });

  it("função que entrou no texto depois: quem autorizou o texto de 27/11 vê o pedido só ao usar, e Permitir libera", async () => {
    bd.linha = { permitido: true, versao: "2026-11-27" };
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(true));
    const resp = bloqueioIa("https://x.supabase.co/functions/v1/import-financial-pdf");
    expect(resp?.status).toBe(403);
    expect(await screen.findByText("Essa função é nova na IA")).toBeInTheDocument();
    expect(screen.getByText(/entrou na lista abaixo depois da sua autorização/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Permitir"));
    await waitFor(() => expect(bd.upsert).toHaveBeenCalledWith({ fn: "responder_consentimento_ia", p_permitido: true, p_versao: VERSAO_DIVULGACAO_IA }));
    await waitFor(() => expect(iaPermitidaPara("import-financial-pdf")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Essa função é nova na IA")).not.toBeInTheDocument());
    expect(bloqueioIa("https://x.supabase.co/functions/v1/import-financial-pdf")).toBeNull();
  });

  it("autorização dada no texto antigo (sem Cerebras) não vale: pergunta de novo e a IA fica fechada", async () => {
    bd.linha = { permitido: true, versao: "2026-11-23" };
    montar();
    expect(await screen.findByText("A VANT usa IA. Você autoriza?")).toBeInTheDocument();
    expect(iaPermitida()).toBe(false);
  });

  it("quem já respondeu não vê a pergunta de novo", async () => {
    bd.linha = { permitido: false, versao: VERSAO_DIVULGACAO_IA };
    montar();
    await waitFor(() => expect(iaPermitida()).toBe(false));
    expect(screen.queryByText("A VANT usa IA. Você autoriza?")).not.toBeInTheDocument();
  });
});
