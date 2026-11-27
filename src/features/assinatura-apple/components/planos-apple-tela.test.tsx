import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { planosDaTela } from "../lib/planos";
import { PRODUTO, type ProdutoApple, type ResultadoCompra } from "../types";
import { textoDoEstado } from "./estado-da-compra";
import { PlanosAppleAviso, PlanosAppleSkeleton, PlanosAppleTela, type PlanosAppleTelaProps } from "./planos-apple-tela";

const p = (id: string, preco: string, formatado: string, unidade: "mes" | "ano"): ProdutoApple =>
  ({ id, nome: id, descricao: "", preco, precoFormatado: formatado, moeda: "BRL", periodo: { unidade, valor: 1 } });
const PLANOS = planosDaTela([p(PRODUTO.essencial, "29.9", "R$ 29,90", "mes"), p(PRODUTO.proMensal, "49.9", "R$ 49,90", "mes"), p(PRODUTO.proAnual, "399.9", "R$ 399,90", "ano")]);

/** The screen with its plan choice held like PlanosApple holds it (a tap on a card picks the plan). */
function Controlada(props: PlanosAppleTelaProps) {
  const [selecionado, setSelecionado] = useState(props.selecionado);
  return <PlanosAppleTela {...props} selecionado={selecionado} onSelecionar={(id) => { props.onSelecionar(id); setSelecionado(id); }} />;
}

function montar(extra: Partial<PlanosAppleTelaProps> = {}) {
  const props: PlanosAppleTelaProps = {
    planos: PLANOS, selecionado: PRODUTO.proAnual, onSelecionar: vi.fn(), fase: "parado", resultado: null,
    onAssinar: vi.fn(), onRestaurar: vi.fn(), onGerenciar: vi.fn(), onTentarDeNovo: vi.fn(), onContinuar: vi.fn(), onVoltar: vi.fn(), onAbrirLink: vi.fn(), ...extra,
  };
  return { props, ...render(<Controlada {...props} />) };
}

const cartao = (titulo: string) => screen.getByRole("button", { name: new RegExp(`^${titulo},`) });
const abrir = (titulo: string) => fireEvent.click(cartao(titulo));

describe("Paywall V3, screen 1: choose your plan", () => {
  it("the promise and three compact cards, annual first and highlighted with its saving; no purchase button here", () => {
    montar();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Venda mais.Saiba quanto lucrou.");
    expect(screen.getByText("Escolha o plano ideal para o seu corre.")).toBeInTheDocument();
    const cards = within(screen.getByRole("region", { name: "Escolha seu plano" })).getAllByRole("button");
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Pro anual, R$ 399,90/ano, economize 33%", "Pro mensal, R$ 49,90/mês", "Essencial, R$ 29,90/mês",
    ]);
    expect(cards[0]?.textContent).toContain("MELHOR CUSTO-BENEFÍCIO");
    expect(cards[0]?.textContent).toContain("Economize 33%");
    expect(screen.queryByRole("button", { name: /^Assinar/ })).toBeNull();
  });

  it("restore, terms and privacy are reachable from the first screen", () => {
    const { props } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar compras" }));
    fireEvent.click(screen.getByRole("button", { name: "Termos de Uso" }));
    fireEvent.click(screen.getByRole("button", { name: "Privacidade" }));
    expect(props.onRestaurar).toHaveBeenCalled();
    expect(props.onAbrirLink).toHaveBeenNthCalledWith(1, "/termos");
    expect(props.onAbrirLink).toHaveBeenNthCalledWith(2, "/privacidade");
  });

  it("everything sits inside the scrolling body, which has no footer covering it", () => {
    const { container } = montar();
    const corpo = container.querySelector("[data-rolagem=paywall]") as HTMLElement;
    expect(corpo.className).toContain("overflow-y-auto");
    expect(corpo.className).toContain("min-h-0");
    expect(corpo).toContainElement(screen.getByRole("region", { name: "Escolha seu plano" }));
    expect(corpo).toContainElement(screen.getByRole("button", { name: "Restaurar compras" }));
    expect(container.querySelector(".sticky")).toBeNull();
  });
});

describe("Paywall V3, screen 2: the plan's details", () => {
  it.each([["Pro anual", "R$ 399,90", "/ano"], ["Pro mensal", "R$ 49,90", "/mês"], ["Essencial", "R$ 29,90", "/mês"]])(
    "%s: tapping its card opens its details, with price, period, billing and renewal, terms, privacy and Apple's purchase", (titulo, preco, periodo) => {
      const { props } = montar();
      abrir(titulo);
      expect(props.onSelecionar).toHaveBeenCalledTimes(1);
      const plano = screen.getByRole("region", { name: titulo });
      expect(within(plano).getByRole("heading", { level: 2 }).textContent).toBe(titulo);
      expect(plano.textContent).toContain(preco);
      expect(plano.textContent).toContain(periodo);
      expect(screen.getByRole("region", { name: "Cobrança e renovação" }).textContent).toMatch(/renova\s+automaticamente/);
      expect(screen.getByRole("button", { name: "Termos de Uso" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Política de Privacidade" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Assinar ${titulo}`) }));
      expect(props.onAssinar).toHaveBeenCalledTimes(1);
    });

  it("Pro anual keeps its two real extras explicit (2 banks, full Mentor IA) over the Pro mensal list; everything else is the same", () => {
    montar();
    const lista = () => within(screen.getByRole("region", { name: /^O que vem no/ })).getAllByRole("listitem").map((li) => li.textContent);
    abrir("Pro anual");
    const anual = lista();
    expect(anual).toContain("2 bancos conectados (Pix automático)SÓ NO ANUAL");
    expect(anual).toContain("Mentor IA completoSÓ NO ANUAL");
    expect(screen.getByText("Cobrado uma vez por ano. Equivale a R$ 33,32 por mês.")).toBeInTheDocument();
    expect(screen.getByText("Economize 33% em relação ao Pro mensal.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    abrir("Pro mensal");
    const mensal = lista();
    expect(mensal).toContain("1 banco conectado (Pix automático)");
    expect(mensal).toContain("Mentor IA ampliado");
    expect(mensal.join(" ")).not.toMatch(/2 bancos|Mentor IA completo|SÓ NO ANUAL/);
    expect(anual.filter((x) => !x?.endsWith("SÓ NO ANUAL"))).toEqual(mensal.filter((x) => x !== "1 banco conectado (Pix automático)" && x !== "Mentor IA ampliado"));
    expect(screen.queryByText(/Economize/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    abrir("Essencial");
    expect(lista().join(" ")).not.toMatch(/banco conectado|SÓ NO ANUAL/);
  });

  it("'Escolher outro plano' goes back to the three cards", () => {
    montar();
    abrir("Essencial");
    expect(screen.queryByRole("region", { name: "Escolha seu plano" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    expect(within(screen.getByRole("region", { name: "Escolha seu plano" })).getAllByRole("button")).toHaveLength(3);
  });

  it("the purchase button is its own footer row, outside the scrolling body, so it never covers the details", () => {
    const { container } = montar();
    abrir("Pro anual");
    const corpo = container.querySelector("[data-rolagem=paywall]") as HTMLElement;
    const comprar = screen.getByRole("button", { name: /^Assinar Pro anual/ });
    expect(corpo).not.toContainElement(comprar);
    expect(corpo).toContainElement(screen.getByRole("region", { name: "Cobrança e renovação" }));
    expect(corpo).toContainElement(screen.getByRole("button", { name: "Restaurar compras" }));
  });

  it("while Apple's sheet is open nothing can be tapped twice, and there is no way back mid-purchase", () => {
    const { rerender, props } = montar();
    abrir("Pro anual");
    rerender(<Controlada {...props} fase="comprando" />);
    expect(screen.getByRole("button", { name: "Abrindo a App Store..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Escolher outro plano/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restaurar compras" })).toBeDisabled();
  });

  it("a plan that is already Apple's: marked on its card; its details say 'Seu plano atual' (off); another plan offers the change and Apple's management", () => {
    const { props } = montar({ planoAtual: PRODUTO.essencial });
    expect(cartao("Essencial").textContent).toContain("SEU PLANO");
    abrir("Essencial");
    expect(screen.getByRole("button", { name: /^Seu plano atual/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Escolher outro plano/ }));
    abrir("Pro anual");
    expect(screen.getByRole("button", { name: /^Trocar para Pro anual/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar assinatura na Apple" }));
    expect(props.onGerenciar).toHaveBeenCalled();
  });
});

describe("loading and notices", () => {
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

describe("a purchase stored without access", () => {
  it("never reads as an active subscription: calm text, no 'Continuar', back to the plans", () => {
    const { props } = montar({ resultado: { estado: "recusada", produto: PRODUTO.proAnual, motivo: "sem_acesso" } });
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toContain("Compra sem acesso nesta conta");
    expect(status).toContain("Você não será cobrado de novo");
    expect(status).not.toMatch(/Assinatura ativa/);
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos planos" }));
    expect(props.onVoltar).toHaveBeenCalled();
  });
});
