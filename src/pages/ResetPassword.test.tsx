import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const verifyOtp = vi.fn();
const updateUser = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null } }),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/shared/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import ResetPassword from "./ResetPassword";

function preencher() {
  fireEvent.change(screen.getByLabelText(/Nova senha/), { target: { value: "senhaNova123" } });
  fireEvent.change(screen.getByLabelText(/Confirme a senha/), { target: { value: "senhaNova123" } });
  fireEvent.click(screen.getByRole("button", { name: /Salvar nova senha/ }));
}

describe("ResetPassword — link que não se gasta ao abrir (03/11)", () => {
  beforeEach(() => {
    verifyOtp.mockReset(); updateUser.mockReset();
    window.history.replaceState({}, "", "/reset-password?token_hash=abc123&type=recovery");
  });

  it("abre o formulário sem gastar o token; só usa o token ao salvar", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    render(<MemoryRouter><ResetPassword /></MemoryRouter>);
    expect(verifyOtp).not.toHaveBeenCalled();
    preencher();
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "senhaNova123" }));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "recovery" });
  });

  it("link já usado ou antigo: explica e pede o e-mail mais recente", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Email link is invalid or has expired" } });
    render(<MemoryRouter><ResetPassword /></MemoryRouter>);
    preencher();
    expect(await screen.findByText(/não vale mais/)).toBeTruthy();
    expect(screen.getByText(/e-mail mais recente/)).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
