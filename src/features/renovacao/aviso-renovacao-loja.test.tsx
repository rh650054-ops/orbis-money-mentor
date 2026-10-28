import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/lib/platform", async (orig) => ({ ...(await orig<typeof import("@/shared/lib/platform")>()), ehAppDaLoja: () => true }));
const consulta = vi.fn();
vi.mock("./api/use-renovacao-pix", () => ({
  useRenovacaoPixQuery: (id: string | undefined) => { consulta(id); return { data: { valor: 29.9, vence_em: "2026-11-01", atrasada: false }, isSuccess: true }; },
  useRenovacaoVencidaQuery: () => ({ data: null }),
}));
import { AvisoRenovacaoPix } from "./components/aviso-renovacao-pix";

describe("renovação no app da loja (modelo Néctar)", () => {
  it("não mostra preço nem Pix e nem consulta a renovação", () => {
    const { container } = render(<QueryClientProvider client={new QueryClient()}><AvisoRenovacaoPix /></QueryClientProvider>);
    expect(container.textContent).toBe("");
    expect(consulta).toHaveBeenCalledWith(undefined);
  });
});
