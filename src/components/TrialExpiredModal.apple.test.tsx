/* iPhone, native billing (27/11/2026): the end-of-trial screen used to stay up after the background
   recovery released the access (it read the plan once, on mount). Now it leaves by itself. */
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ status: { status: "inactive" } }) }));
vi.mock("@/components/jornada/useJornada", () => ({ useJornada: () => ({ vendidoNoTeste: 0 }) }));
vi.mock("@/components/jornada/EscolhaPlano", () => ({ EscolhaPlano: () => null }));
vi.mock("@/hooks/useVoltaDoCheckout", () => ({ useVoltaDoCheckout: () => undefined }));
vi.mock("@/shared/lib/verificar-acesso", () => ({ verificarAcessoPago: async () => true }));
vi.mock("@/features/renovacao", () => ({
  PixVencido: () => null, RenovarPix: () => null,
  useRenovacaoPixQuery: () => ({ data: null, isSuccess: true }), useRenovacaoVencidaQuery: () => ({ data: null }),
}));
vi.mock("@/shared/components/assinatura-loja", () => ({
  TelaAssinarPelaApple: () => <div data-testid="paywall-apple" />, TelaAssinarPeloSite: () => null,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/shared/lib/cobranca-loja", async (orig) => ({ ...(await orig<object>()), assinaPelaApple: () => true, assinaPeloSite: () => false }));

import TrialExpiredModal from "./TrialExpiredModal";
import { EVENTO_APPLE_LIBEROU } from "@/shared/lib/cobranca-loja";

describe("end-of-trial screen on the iPhone", () => {
  const original = window.location;
  afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: original }));

  it("shows the full-screen Apple paywall and leaves by itself when the background recovery releases the access", () => {
    const recarregar = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, reload: recarregar } });
    render(<TrialExpiredModal isOpen />);
    expect(screen.getByTestId("paywall-apple")).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event(EVENTO_APPLE_LIBEROU)); });
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("closed, it does not listen", () => {
    const recarregar = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, reload: recarregar } });
    render(<TrialExpiredModal isOpen={false} />);
    act(() => { window.dispatchEvent(new Event(EVENTO_APPLE_LIBEROU)); });
    expect(recarregar).not.toHaveBeenCalled();
  });
});
