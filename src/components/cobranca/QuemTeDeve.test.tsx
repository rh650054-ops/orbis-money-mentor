import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { FilaEnvio, ListaDevedores, ResumoRecuperado } from "./QuemTeDeve";

describe("Cobrador · quem te deve", () => {
  it("mostra o recuperado do mês e a lista", () => {
    render(<ResumoRecuperado p={{ recuperado_mes: 270, pagas_mes: 2, criadas_mes: 3, abertas: [] }} />);
    expect(screen.getByText(/2 DE 3 COBRANÇAS PAGAS/)).toBeTruthy();
    const onNovo = vi.fn();
    render(<ListaDevedores onNovo={onNovo} onAberta={() => {}} abertas={[]}
      novos={[{ client_id: "c1", nome: "José Silva", telefone: "11988421190", valor: 180, metodo: null, hora: null, cobranca_id: null, cobranca_status: null, cobranca_link: null, cobranca_valor: null }]} />);
    fireEvent.click(screen.getByText("José Silva"));
    expect(onNovo).toHaveBeenCalled();
  });

  it("a fila manda um por vez", () => {
    const onMandar = vi.fn();
    render(<FilaEnvio falhas={0} onCopiar={() => {}} onPronto={() => {}} onMandar={onMandar}
      itens={[{ id: "1", nome: "Maria Alves", telefone: "11977314408", valor: 90, link: "x", enviado: false }]} />);
    fireEvent.click(screen.getByText(/mandar pro Maria/));
    expect(onMandar).toHaveBeenCalled();
  });
});
