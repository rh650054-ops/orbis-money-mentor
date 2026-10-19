import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RevisarFolha } from "./RevisarFolha";

const mover = vi.fn();
const criar = vi.fn((_v: unknown, o: { onSuccess: (c: { slug: string; rotulo: string }) => void }) => o.onSuccess({ slug: "u_abc", rotulo: "Ração do Thor" }));
vi.mock("./use-analise", () => ({
  useCategoriasSaida: () => ({ data: [
    { slug: "mercado", rotulo: "Mercado", tipo: "saida", esfera_padrao: "pessoal", ordem: 13 },
    { slug: "outros", rotulo: "Outros", tipo: "saida", esfera_padrao: "pessoal", ordem: 99 },
    { slug: "u_old", rotulo: "Academia", tipo: "saida", esfera_padrao: "pessoal", ordem: 900 },
  ] }),
  useAcaoLancamento: () => ({ mutate: mover, isPending: false }),
}));
vi.mock("./use-categoria", () => ({ useCriarCategoria: () => ({ mutate: criar, isPending: false }), erroCategoria: () => "erro" }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn() }));

const pendente = { id: "t1", data: "2026-10-18", nome: "PET SHOP", valor: 89.9, banco: "Nubank", categoria: "outros" };

describe("Outros vira tópico", () => {
  it("own topics show up as quick options; Outros asks for a name and moves the expense to the new topic", () => {
    render(<RevisarFolha aberta pendentes={[pendente] as never} onFechar={() => {}} />);
    expect(screen.getByText("Academia")).toBeTruthy();
    fireEvent.click(screen.getByText("Outros"));
    expect(mover).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nome do tópico"), { target: { value: "Ração do Thor" } });
    fireEvent.click(screen.getByText("Criar tópico"));
    expect(criar).toHaveBeenCalledWith({ nome: "Ração do Thor", teto: null }, expect.anything());
    expect(mover).toHaveBeenCalledWith({ tipo: "mover", id: "t1", categoria: "u_abc", todos: false }, expect.anything());
  });

  it("can still leave it in plain Outros", () => {
    mover.mockClear();
    render(<RevisarFolha aberta pendentes={[pendente] as never} onFechar={() => {}} />);
    fireEvent.click(screen.getByText("Outros"));
    fireEvent.click(screen.getByText("Deixar em Outros"));
    expect(mover).toHaveBeenCalledWith(expect.objectContaining({ categoria: "outros" }), expect.anything());
  });
});
