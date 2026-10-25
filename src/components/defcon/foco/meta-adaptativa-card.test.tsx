import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { lerMetaDoDia, type MetaDoDia } from "@/shared/lib/meta-viavel";
import { MetaAdaptativaCard } from "./meta-adaptativa-card";

const linha = (extra: object) => lerMetaDoDia({
  dia: "2026-10-25", meta: 1200, ritmo: 250, turbo: 400, minimo: 260, status: "inviavel", ticket: 10,
  falta_mes: 6000, mes_viavel: 4000, amostra_dia: 3, meta_mensal: 9000, precisa_dia: 1200, vendido_mes: 3000,
  dias_restantes: 5, curva: [], plano_maximo: null, meta_adaptativa: 330, dias_vendidos: 12, ...extra,
}) as MetaDoDia;

describe("MetaAdaptativaCard", () => {
  it("modo padrão: oferece as 3 metas e liga", () => {
    const onTrocar = vi.fn();
    render(<MetaAdaptativaCard m={linha({ modo: "padrao" })} estado="antes" salvando={false} onTrocar={onTrocar} />);
    expect(screen.getByText("Quer melhorar sua performance?")).toBeInTheDocument();
    expect(screen.getByText("Turbo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ligar meta adaptativa" }));
    expect(onTrocar).toHaveBeenCalledWith(true);
  });

  it("ligada: volta pra meta dele", () => {
    const onTrocar = vi.fn();
    render(<MetaAdaptativaCard m={linha({ modo: "adaptativo", meta: 330 })} estado="antes" salvando={false} onTrocar={onTrocar} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar minha meta" }));
    expect(onTrocar).toHaveBeenCalledWith(false);
  });

  it("conta nova não vê o card", () => {
    const { container } = render(<MetaAdaptativaCard m={linha({ modo: "padrao", dias_vendidos: 1 })} estado="antes" salvando={false} onTrocar={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
