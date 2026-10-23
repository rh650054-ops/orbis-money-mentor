import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SuportePage from "./suporte-page";
import ExcluirContaPage from "./excluir-conta-page";

const abrir = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

describe("store pages", () => {
  it("support shows WhatsApp, e-mail and the delete-account link", () => {
    abrir(<SuportePage />);
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("wa.me/"));
    expect(screen.getByRole("link", { name: /suporte@vantapp.com.br/ })).toHaveAttribute("href", "mailto:suporte@vantapp.com.br");
    expect(screen.getByRole("link", { name: "Excluir conta" })).toHaveAttribute("href", "/excluir-conta");
  });

  it("delete-account explains the in-app path and the no-app request", () => {
    abrir(<ExcluirContaPage />);
    expect(screen.getByText("Minha Conta")).toBeInTheDocument();
    expect(screen.getByText(/em até 15 dias/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Minha Conta" })).toHaveAttribute("href", "/my-account");
  });
});
