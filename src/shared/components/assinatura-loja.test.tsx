import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const abrir = vi.hoisted(() => ({ assinar: vi.fn(), renovar: vi.fn() }));
vi.mock("@/shared/lib/assinar-no-site", () => ({ abrirAssinarNoSite: abrir.assinar, abrirRenovarNoSite: abrir.renovar }));
vi.mock("@/shared/lib/link-externo", () => ({ abrirLinkExterno: vi.fn() }));
import { TelaAssinarPeloSite } from "./assinatura-loja";

describe("tela sem acesso no app da loja", () => {
  it("teste encerrado: VER PLANOS E ASSINAR abre a página de planos; já paguei e suporte ficam", () => {
    const tentar = vi.fn();
    render(<TelaAssinarPeloSite titulo="Seu teste encerrou" onTentar={tentar} />);
    fireEvent.click(screen.getByText("VER PLANOS E ASSINAR"));
    expect(abrir.assinar).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Já paguei, verificar acesso"));
    expect(tentar).toHaveBeenCalled();
    expect(screen.getByText("Falar com o suporte")).toBeTruthy();
  });
  it("ex-assinante: RENOVAR ASSINATURA vai pro checkout", () => {
    render(<TelaAssinarPeloSite modo="renovar" />);
    fireEvent.click(screen.getByText("RENOVAR ASSINATURA"));
    expect(abrir.renovar).toHaveBeenCalled();
  });
});
