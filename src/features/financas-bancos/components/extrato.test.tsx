import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Movimento } from "../lib/extrato";
import type { ContaNoSaldo } from "../lib/saldo";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } } }));
const dados: { data: Movimento[] | undefined; isLoading: boolean; isError: boolean } = { data: [], isLoading: false, isError: false };
const pedidos: string[] = [];
vi.mock("../api/use-extrato-query", () => ({ useExtratoQuery: (_u: string, mes: string) => { pedidos.push(mes); return dados; } }));

import { doBanco, mesesRecentes, porTipo, totais } from "../lib/extrato";
import { ExtratoBanco } from "./extrato-banco";

const mov = (o: Partial<Movimento>): Movimento => ({ id: Math.random().toString(36), data: "2026-11-20", hora: "10:00", descricao: "Pix", comerciante: null,
  valor: 10, tipo: "entrada", banco: "C6 Bank", movimento: "normal", ...o });
const lista = [
  mov({ valor: 40, comerciante: "Cliente A" }), mov({ valor: 20, tipo: "saida", comerciante: "Mercado" }),
  mov({ valor: 15, banco: "c6 bank ", movimento: "entre_contas", tipo: "saida", descricao: "Transferência" }),
  mov({ valor: 999, banco: "Santander" }),
];
const conta: ContaNoSaldo = {
  id: "c1", banco: "C6 Bank", saldo: 512.4, estado: "recente", papel: "trabalho", desconectada: false,
  conexao: { id: "c1", item_id: "i1", institution_name: "C6 Bank", institution_logo: null, status: "UPDATED", last_synced_at: new Date().toISOString(), papel: "trabalho" },
};
const props = { userId: "u", oculto: false, onFechar: vi.fn(), onGerenciar: vi.fn() };

describe("statement of one bank: rules", () => {
  it("only this bank's movements (name, case and spaces ignored)", () => {
    expect(doBanco(lista, "C6 Bank")).toHaveLength(3);
    expect(doBanco(lista, "Santander")).toHaveLength(1);
  });
  it("totals of entries and exits, and the type filter", () => {
    const c6 = doBanco(lista, "C6 Bank");
    expect(totais(c6)).toEqual({ entradas: 40, saidas: 35, qtd: 3 });
    expect(porTipo(c6, "entrada")).toHaveLength(1);
    expect(porTipo(c6, "saida")).toHaveLength(2);
    expect(porTipo(c6, "tudo")).toHaveLength(3);
  });
  it("periods: this month and the two before, in Brazil time", () => {
    expect(mesesRecentes(3, new Date("2026-12-01T01:00:00Z"))).toEqual(["2026-11-01", "2026-10-01", "2026-09-01"]);
    expect(mesesRecentes(2, new Date("2026-01-15T12:00:00Z"))).toEqual(["2026-01-01", "2025-12-01"]);
  });
});

describe("statement sheet", () => {
  it("shows the bank, its role, balance, totals and movements; filters by type", () => {
    dados.data = lista;
    render(<ExtratoBanco conta={conta} {...props} />);
    expect(screen.getAllByText("C6 Bank").length).toBeGreaterThan(0);
    expect(screen.getByText("Trabalho")).toBeTruthy();
    expect(screen.getByText(/Atualizado às/)).toBeTruthy();
    expect(screen.getByText("Cliente A")).toBeTruthy();
    expect(screen.queryByText(/999/)).toBeNull();
    expect(screen.getByText(/entre suas contas/)).toBeTruthy();
    fireEvent.click(screen.getByText("Entradas", { selector: "button" }));
    expect(screen.queryByText("Mercado")).toBeNull();
    expect(screen.getByText("Cliente A")).toBeTruthy();
  });
  it("changing the period reads that month", () => {
    dados.data = [];
    pedidos.length = 0;
    render(<ExtratoBanco conta={conta} {...props} />);
    const botoes = screen.getByRole("group", { name: "Período" }).querySelectorAll("button");
    fireEvent.click(botoes[1]!);
    expect(pedidos.at(-1)).toBe(mesesRecentes(3)[1]);
    expect(screen.getByText(/Nenhuma movimentação/)).toBeTruthy();
  });
  it("an unconfirmed balance is labelled as the last known one", () => {
    dados.data = [];
    render(<ExtratoBanco conta={{ ...conta, estado: "sem_confirmacao" }} {...props} />);
    expect(screen.getByText("Último saldo conhecido")).toBeTruthy();
    expect(screen.getByText(/Sem confirmação recente · desde/)).toBeTruthy();
  });
  it("hidden values: no amount readable, the list stays", () => {
    dados.data = lista;
    const { baseElement } = render(<ExtratoBanco conta={conta} {...props} oculto />);
    expect((baseElement.textContent ?? "").replace(/\s/g, " ")).not.toMatch(/R\$ ?\d/);
    expect(screen.getByText("Cliente A")).toBeTruthy();
  });
  it("'Gerenciar conexão' goes to the existing management sheet", () => {
    dados.data = [];
    const onGerenciar = vi.fn();
    render(<ExtratoBanco conta={conta} {...props} onGerenciar={onGerenciar} />);
    fireEvent.click(screen.getByText("Gerenciar conexão"));
    expect(onGerenciar).toHaveBeenCalled();
  });
  it("loading and error states", () => {
    dados.data = undefined; dados.isError = true;
    render(<ExtratoBanco conta={conta} {...props} />);
    expect(screen.getByText(/Não deu para abrir o extrato agora/)).toBeTruthy();
    dados.isError = false;
  });
});
