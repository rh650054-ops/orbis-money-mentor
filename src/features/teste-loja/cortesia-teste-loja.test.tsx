import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let loja = true;
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/lib/platform", async (orig) => ({ ...(await orig<typeof import("@/shared/lib/platform")>()), ehAppDaLoja: () => loja }));
const rpc = vi.fn();
vi.mock("@/shared/api", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const toast = vi.fn();
vi.mock("@/shared/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
import { CortesiaTesteLojaGate } from "./components/cortesia-teste-loja-gate";
import { AvisoCortesia } from "./components/aviso-cortesia";
import { jaPediu } from "./lib/pedido";

const montar = () => render(<QueryClientProvider client={new QueryClient()}><CortesiaTesteLojaGate /></QueryClientProvider>);

describe("cortesia do teste fechado da Play Store", () => {
  beforeEach(() => { localStorage.clear(); rpc.mockReset(); loja = true; });

  it("no app da loja pede uma vez por conta e não pede de novo", async () => {
    rpc.mockResolvedValue({ data: "fora", error: null });
    const { unmount } = montar();
    await waitFor(() => expect(jaPediu("u1")).toBe(true));
    expect(rpc).toHaveBeenCalledWith("cortesia_teste_loja_pedir");
    unmount();
    montar();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("no site/PWA não pede", () => {
    loja = false;
    montar();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("26/11: the courtesy notice says the exact end date from the server", async () => {
    sessionStorage.setItem("vant_cortesia_loja_aviso", "1");
    rpc.mockResolvedValue({ data: "2026-12-25", error: null });
    render(<AvisoCortesia />);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Você ganhou 30 dias de teste: até 25/12/2026" })));
    expect(rpc).toHaveBeenCalledWith("cortesia_teste_loja_minha");
  });
});
