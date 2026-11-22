import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const produtos = vi.hoisted(() => ({ lista: [] as unknown[] }));
vi.mock("../api/use-acesso-produtos-query", () => ({ useAcessoProdutosQuery: () => ({ data: { liberado: true } }) }));
vi.mock("../api/use-produtos-query", () => ({ useProdutosQuery: () => ({ data: produtos.lista }) }));
import { ConviteCadastro } from "./convite-cadastro";

const abrir = () => render(<MemoryRouter><ConviteCadastro userId="u1" /></MemoryRouter>);
beforeEach(() => { localStorage.clear(); produtos.lista = []; });

describe("banner 'Você vende bem. Mas sabe quanto realmente lucra?'", () => {
  it("mostra o texto e as três ações para quem não tem produto", () => {
    abrir();
    expect(screen.getByText(/Você vende bem\. Mas sabe quanto/)).toBeInTheDocument();
    expect(screen.getByText("Cadastre seus produtos para acompanhar seus custos, estoque e produção.")).toBeInTheDocument();
    for (const t of ["Cadastrar meus produtos", "Mais tarde", "Não mostrar novamente"]) expect(screen.getByText(t)).toBeInTheDocument();
  });
  it("'Mais tarde' fecha agora e não volta ao reabrir a tela", () => {
    const t = abrir();
    fireEvent.click(screen.getByText("Mais tarde"));
    expect(screen.queryByText("Cadastrar meus produtos")).toBeNull();
    t.unmount(); abrir();
    expect(screen.queryByText("Cadastrar meus produtos")).toBeNull();
  });
  it("'Não mostrar novamente' fecha para sempre", () => {
    const t = abrir();
    fireEvent.click(screen.getByText("Não mostrar novamente"));
    t.unmount(); abrir();
    expect(screen.queryByText("Cadastrar meus produtos")).toBeNull();
    expect(JSON.parse(localStorage.getItem("vant_convite_cadastro_v1:u1")!)).toEqual({ nunca: true });
  });
  it("quem já tem produto não vê o banner", () => {
    produtos.lista = [{ id: "p" }];
    abrir();
    expect(screen.queryByText("Cadastrar meus produtos")).toBeNull();
  });
});
