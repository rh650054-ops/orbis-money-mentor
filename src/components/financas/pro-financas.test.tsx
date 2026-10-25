import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BancosTravado, LimitePlano } from "./pro-financas";
import { abaValida } from "./FinancasAbas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("Finanças no Essencial", () => {
  it("limite mostra quanto usou e leva pro Pro", () => {
    const onPro = vi.fn();
    render(<LimitePlano titulo="Adicionar conta" usados={7} limite={5} onPro={onPro} />);
    expect(screen.getByText("5 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onPro).toHaveBeenCalled();
  });

  it("aba Bancos travada mostra o chamado do Pro", () => {
    const onPro = vi.fn();
    render(<MemoryRouter><BancosTravado onPro={onPro} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Liberar com o VANT Pro" }));
    expect(onPro).toHaveBeenCalled();
  });

  it("aba Bancos só abre com banco ou travada pro Essencial", () => {
    expect(abaValida("bancos", false)).toBe("resumo");
    expect(abaValida("bancos", true)).toBe("bancos");
    expect(abaValida("bancos", false, true)).toBe("bancos");
  });
});
