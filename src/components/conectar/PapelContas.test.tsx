import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { BancoExtra, PapelEscolha, PapelToggle } from "./PapelContas";

describe("conta de trabalho × reserva", () => {
  it("pergunta pra que serve cada conta", () => {
    render(<PapelEscolha onPronto={() => {}} contas={[
      { id: "a", banco: "C6 Bank", papel: null, saldo: 593 }, { id: "b", banco: "Santander", papel: null, saldo: 1175 }]} />);
    expect(screen.getByText(/2 contas conectadas: C6 Bank e Santander/)).toBeTruthy();
  });
  it("o toggle avisa a escolha", () => {
    const fn = vi.fn();
    render(<PapelToggle valor={null} onEscolher={fn} />);
    fireEvent.click(screen.getByText("Reserva"));
    expect(fn).toHaveBeenCalledWith("reserva");
  });
  it("banco a mais custa R$ 10", () => {
    render(<BancoExtra usados={1} onFechar={() => {}} />);
    expect(screen.getByText("+R$ 10 por mês")).toBeTruthy();
  });
});
