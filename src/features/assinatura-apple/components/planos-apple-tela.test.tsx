import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { planosDaTela } from "../lib/planos";
import { PRODUTO, type ProdutoApple, type ResultadoCompra } from "../types";
import { textoDoEstado } from "./estado-da-compra";
import { PlanosAppleAviso, PlanosAppleSkeleton, PlanosAppleTela, type PlanosAppleTelaProps } from "./planos-apple-tela";

const p = (id: string, preco: string, formatado: string, unidade: "mes" | "ano"): ProdutoApple =>
  ({ id, nome: id, descricao: "", preco, precoFormatado: formatado, moeda: "BRL", periodo: { unidade, valor: 1 } });
const PLANOS = planosDaTela([p(PRODUTO.essencial, "29.9", "R$ 29,90", "mes"), p(PRODUTO.proMensal, "49.9", "R$ 49,90", "mes"), p(PRODUTO.proAnual, "419.9", "R$ 419,90", "ano")]);

function montar(extra: Partial<PlanosAppleTelaProps> = {}) {
  const props: PlanosAppleTelaProps = {
    planos: PLANOS, selecionado: PRODUTO.proAnual, onSelecionar: vi.fn(), fase: "parado", resultado: null,
    onAssinar: vi.fn(), onRestaurar: vi.fn(), onGerenciar: vi.fn(), onTentarDeNovo: vi.fn(), onContinuar: vi.fn(), onVoltar: vi.fn(), onAbrirLink: vi.fn(), ...extra,
  };
  return { props, ...render(<PlanosAppleTela {...props} />) };
}

const radio = (titulo: string) => screen.getAllByRole("radio").find((r) => r.textContent?.includes(titulo)) as HTMLButtonElement;

describe("the plans screen", () => {
  it("three plans, the annual one selected and highlighted, with the saving", () => {
    montar();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios[0]?.textContent).toContain("Pro anual");
    expect(screen.getByText("MELHOR CUSTO-BENEFÍCIO")).toBeInTheDocument();
    expect(screen.getByText("Economize 30%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Assinar Pro anual/ })).toBeEnabled();
  });

  it("the annual price shown as the price is the total charged per year; the monthly equivalent is a smaller line that says it is charged once a year", () => {
    montar();
    const anual = radio("Pro anual");
    const grande = anual.querySelector(".text-\\[26px\\]");
    expect(grande?.textContent).toBe("R$ 419,90");
    expect(anual.textContent).toContain("/ano");
    expect(anual.textContent?.replace(/\s/g, " ")).toContain("Cobrado uma vez por ano. Equivale a R$ 34,99 por mês.");
    expect(anual.textContent).not.toMatch(/12x|parcela/i);
    expect(screen.getByText(/R\$ 419,90 cobrados uma vez por ano\. Renovação automática\./)).toBeInTheDocument();
  });

  it("choosing a plan and subscribing call back; the button names the chosen plan", () => {
    const { props, rerender } = montar();
    fireEvent.click(radio("Essencial"));
    expect(props.onSelecionar).toHaveBeenCalledWith(PRODUTO.essencial);
    rerender(<PlanosAppleTela {...props} selecionado={PRODUTO.essencial} />);
    fireEvent.click(screen.getByRole("button", { name: /^Assinar Essencial/ }));
    expect(props.onAssinar).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/R\$ 29,90 por mês\. Renovação automática\./)).toBeInTheDocument();
    expect(screen.getByText(/Ao assinar, você concorda com os Termos de Uso e a Política de Privacidade\./)).toBeInTheDocument();
  });

  it("restore, terms and privacy are always there", () => {
    const { props } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar compras" }));
    fireEvent.click(screen.getByRole("button", { name: "Termos de Uso" }));
    fireEvent.click(screen.getByRole("button", { name: "Privacidade" }));
    expect(props.onRestaurar).toHaveBeenCalled();
    expect(props.onAbrirLink).toHaveBeenNthCalledWith(1, "/termos");
    expect(props.onAbrirLink).toHaveBeenNthCalledWith(2, "/privacidade");
  });

  it("while Apple's sheet is open nothing can be tapped twice", () => {
    montar({ fase: "comprando" });
    expect(screen.getByRole("button", { name: "Abrindo a App Store..." })).toBeDisabled();
    expect(screen.getAllByRole("radio").every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByRole("button", { name: "Restaurar compras" })).toBeDisabled();
  });

  it("a plan that is already Apple's: marked, not buyable again, the button changes plan and Apple's management is offered", () => {
    const { props } = montar({ planoAtual: PRODUTO.essencial, selecionado: PRODUTO.proAnual });
    expect(screen.getByText("SEU PLANO")).toBeInTheDocument();
    expect(radio("Essencial")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Trocar para Pro anual/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar assinatura na Apple" }));
    expect(props.onGerenciar).toHaveBeenCalled();
  });

  it("the loading shape and the 'no purchase offered' notice", () => {
    const { unmount } = render(<PlanosAppleSkeleton />);
    expect(screen.getByLabelText("Carregando planos")).toHaveAttribute("aria-busy", "true");
    unmount();
    render(<PlanosAppleAviso titulo="Seu plano está ativo" texto="Você já assina a VANT." />);
    expect(screen.getByRole("status").textContent).toContain("Seu plano está ativo");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("after a purchase attempt", () => {
  const casos: [ResultadoCompra, string, string | null][] = [
    [{ estado: "liberada", produto: PRODUTO.proAnual }, "Assinatura ativa", "Continuar"],
    [{ estado: "pendente_aprovacao", produto: PRODUTO.proAnual }, "Compra aguardando aprovação", null],
    [{ estado: "aguardando_servidor", produto: PRODUTO.proAnual, motivo: "sem_internet" }, "Pagamento recebido", "Tentar de novo"],
    [{ estado: "aguardando_servidor", produto: PRODUTO.proAnual, motivo: "servidor" }, "Confirmando sua assinatura", "Tentar de novo"],
    [{ estado: "de_outra_conta", produto: PRODUTO.proAnual }, "Compra de outra conta VANT", null],
    [{ estado: "recusada", produto: PRODUTO.proAnual, motivo: "reembolsada" }, "Esta compra foi reembolsada", null],
    [{ estado: "falhou", motivo: "sem_internet" }, "Sem internet", null],
    [{ estado: "falhou", motivo: "falha_na_loja" }, "A App Store não respondeu", null],
  ];
  it.each(casos)("%o shows its own message and the right button, and hides the plans", (resultado, titulo, botao) => {
    const { props } = montar({ resultado });
    expect(screen.getByRole("status").textContent).toContain(titulo);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    if (botao) {
      fireEvent.click(screen.getByRole("button", { name: botao }));
      expect(botao === "Continuar" ? props.onContinuar : props.onTentarDeNovo).toHaveBeenCalled();
    }
  });

  it("a paid purchase waiting for the server always says the customer will not be charged again; a failure before payment always says nothing was charged", () => {
    for (const motivo of ["sem_internet", "servidor", "sessao"] as const) expect(textoDoEstado({ estado: "aguardando_servidor", produto: "x", motivo }).texto).toContain("Você não será cobrado de novo");
    for (const motivo of ["sem_internet", "produto_indisponivel", "falha_na_loja"] as const) expect(textoDoEstado({ estado: "falhou", motivo }).texto).toContain("Nada foi cobrado");
    expect(textoDoEstado({ estado: "pendente_aprovacao", produto: "x" }).texto).toContain("Nada foi cobrado");
  });
});
