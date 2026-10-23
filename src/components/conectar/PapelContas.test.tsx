import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
import { BancoExtra, ContasDeVenda, PapelToggle } from "./PapelContas";
import type { ContaVenda } from "./pluggy";

const conta = (o: Partial<ContaVenda>): ContaVenda => ({
  id: "a", banco: "InfinitePay", logo: null, papel: null, saldo: 0, sugestao: null, motivo: null,
  entradas_30d: 0, pode_trocar: true, troca_liberada_em: null, conta_venda: false, ...o,
});

describe("conta de trabalho × pessoal", () => {
  it("pergunta pra que serve cada conta e mostra a sugestão da Vant", () => {
    render(<ContasDeVenda onMudou={() => {}} contas={[
      conta({ id: "a", banco: "InfinitePay", sugestao: "trabalho", motivo: "195 entradas em 30 dias." }),
      conta({ id: "b", banco: "Itaú", papel: "pessoal" })]} />);
    expect(screen.getByText("falta 1")).toBeTruthy();
    expect(screen.getByText(/A Vant acha que é/)).toBeTruthy();
  });
  it("conta travada mostra quando libera virar pessoal", () => {
    render(<ContasDeVenda onMudou={() => {}} contas={[
      conta({ papel: "trabalho", pode_trocar: false, troca_liberada_em: "2026-10-11T12:00:00Z" }), conta({ id: "b", papel: "pessoal" })]} />);
    expect(screen.getByText(/virar pessoal liberado em 11\/10/)).toBeTruthy();
  });
  it("o toggle avisa a escolha", () => {
    const fn = vi.fn();
    render(<PapelToggle valor={null} onEscolher={fn} />);
    fireEvent.click(screen.getByText("Pessoal"));
    expect(fn).toHaveBeenCalledWith("pessoal");
  });
  it("banco a mais custa R$ 12,90", () => {
    render(<BancoExtra usados={1} onFechar={() => {}} />);
    expect(screen.getByText("+R$ 12,90 por mês")).toBeTruthy();
  });
  it("banco a mais abre o checkout com o e-mail da conta", () => {
    render(<BancoExtra usados={1} email="rick@vant.com" onFechar={() => {}} />);
    const a = screen.getByText("QUERO LIGAR MAIS UM BANCO").closest("a");
    expect(a?.getAttribute("href")).toContain("off=3nnrr1xn");
    expect(a?.getAttribute("href")).toContain("email=rick%40vant.com");
  });
});

describe("conta que começa como trabalho (23/10)", () => {
  it("papel automático + Vant acha pessoal: mostra a sugestão", () => {
    render(<ContasDeVenda onMudou={() => {}} contas={[
      { id: "a", banco: "Nubank", logo: null, papel: "trabalho", papel_auto: true, saldo: null, sugestao: "pessoal", motivo: "Poucas entradas.",
        entradas_30d: 2, pode_trocar: true, troca_liberada_em: null, conta_venda: true }]} />);
    expect(screen.getByText(/A Vant acha que é/)).toBeTruthy();
  });
});
