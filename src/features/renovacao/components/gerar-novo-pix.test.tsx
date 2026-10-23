import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const abrir = vi.fn();
vi.mock("@/shared/lib/link-externo", () => ({ abrirLinkExterno: (u: string) => abrir(u) }));
import { PixVencido } from "./gerar-novo-pix";
import { venceuTexto } from "../lib/pix";

describe("PixVencido", () => {
  it("says the Pix expired and opens the Hotmart customer area", () => {
    render(<PixVencido vencida={{ subscription_id: "X", plano: "Membro Fundador", valor: 29.9, venceu_em: "2026-10-22T23:59:59Z" }} />);
    expect(screen.getByText(/R\$ 29,90/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Gerar novo Pix/ }));
    expect(abrir).toHaveBeenCalledWith("https://consumer.hotmart.com/purchase");
  });

  it("venceuTexto: today, yesterday, date", () => {
    const agora = new Date(2026, 9, 23, 15);
    expect(venceuTexto(new Date(2026, 9, 23, 1).toISOString(), agora)).toBe("venceu hoje");
    expect(venceuTexto(new Date(2026, 9, 22, 20).toISOString(), agora)).toBe("venceu ontem");
    expect(venceuTexto(new Date(2026, 9, 18, 20).toISOString(), agora)).toBe("venceu dia 18/10");
  });
});
