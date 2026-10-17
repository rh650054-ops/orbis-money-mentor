import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const saldo = { isLoading: false, isError: false, data: 0 as number | undefined };
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("../api/use-saldo-antigo-query", () => ({ useSaldoAntigoQuery: () => saldo }));

import CarteiraEncerradaPage from "./carteira-encerrada-page";

const abrir = () => render(<MemoryRouter><CarteiraEncerradaPage /></MemoryRouter>);

describe("/x1/carteira (carteira encerrada)", () => {
  it("explica que o X1 vale só pontos e não oferece depósito, saque nem aposta", () => {
    saldo.data = 0;
    const { container } = abrir();
    expect(screen.getByText("O X1 agora vale só pontos")).toBeTruthy();
    expect(screen.getByText(/não viram dinheiro/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/depositar|sacar|pix copia|apostar/i);
    expect(screen.queryByLabelText("Saldo antigo")).toBeNull();
  });

  it("quem tinha saldo antigo vê o valor e o caminho pro suporte devolver", () => {
    saldo.data = 2;
    abrir();
    expect(screen.getByLabelText("Saldo antigo").textContent).toMatch(/R\$\s?2,00/);
    expect(screen.getByRole("link", { name: /Falar com o suporte/ }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\//);
  });
});
