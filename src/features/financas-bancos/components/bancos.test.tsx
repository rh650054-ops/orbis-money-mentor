import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import type { BancoLigado } from "@/components/conectar/pluggy";
import type { Painel } from "@/components/financas/FinancasPainel";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } } }));
const ligar = vi.fn();
vi.mock("@/features/vender", async (orig) => ({
  ...(await orig<typeof import("@/features/vender")>()),
  useLigarBanco: () => ({ ligar, ligando: false, precisaExtra: false, fecharExtra: vi.fn() }),
}));

import { PainelGaveta } from "@/components/financas/FinancasPainel";
import { abaValida } from "@/components/financas/FinancasAbas";
import { agrupar, totalDoGrupo } from "../lib/contas";
import { dinheiro, useOcultarValores } from "../lib/ocultar";
import { linhasDaOrganizacao } from "../lib/organizacao";
import { bancosRepetidos, consolidar, distribuicao } from "../lib/saldo";
import { SaldoDisponivel } from "./saldo-disponivel";
import { DinheiroDisponivel } from "./dinheiro-resumo";
import { GrupoContas } from "./grupo-contas";
import { OrganizacaoFinanceira } from "./organizacao";
import { PrimeiroBanco } from "./primeiro-banco";

const agora = new Date().toISOString();
const velho = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
const conexao = (o: Partial<BancoLigado> = {}): BancoLigado => ({
  id: "c1", item_id: "i1", institution_name: "Banco A", institution_logo: null, status: "UPDATED", last_synced_at: agora, papel: "trabalho", ...o,
});
/** Rick's example of 28/11: Alfa 612,30 ok · Beta 218,18 disconnected · Gama 500,99 ok */
const exemplo = (o: Partial<HomeFinancas> = {}): HomeFinancas => ({
  tem_banco: true, tem_saldo: true, saldo: 1331.47, bancos: [], atualizado: agora, fixas_mes: 0, folego_dias: null,
  entrou: 0, saiu: 0, sobrou: 0, alerta: null, causas: null, piloto: { lancamentos: 0, conferir: 0 },
  saldo_trabalho: 830.48, saldo_pessoal: 500.99,
  contas: [{ id: "a", banco: "Banco Alfa", papel: "trabalho", saldo: 612.3 }, { id: "b", banco: "Banco Beta", papel: "trabalho", saldo: 218.18 },
    { id: "g", banco: "Banco Gama", papel: "pessoal", saldo: 500.99 }], ...o,
});
const conexoesExemplo = [conexao({ id: "a" }), conexao({ id: "b", status: "USER_INPUT_TIMEOUT", last_synced_at: velho }), conexao({ id: "g", papel: "pessoal" })];
const painel = (o: Partial<Painel> = {}): Painel => ({
  tem_cartao: true, cartoes: [{ banco: "A", nome: "Cartão", fatura: 450, limite: 1000, disponivel: 550, vence: null, minimo: null }],
  parcelas: [], parcelas_por_mes: [], parcelas_mes: 0, parcelas_total: 0,
  tem_emprestimo: false, emprestimos: [], especial_usado: 120, especial_limite: 500, juros_mes: { emprestimo: 0, especial: 9.6 },
  tem_investimento: true, investimentos: [{ banco: "A", nome: "CDB", tipo: "x", saldo: 2000 }], guardado: 2000, reserva: 800,
  saldo_contas: 1000, dividas: 570, dia_de_rua: 200, leitura: null, ...o,
});
const so = (t: string | null) => (t ?? "").replace(/\s/g, " ");
const grupo = { oculto: false, ligando: false, onAbrir: vi.fn(), onAutorizar: vi.fn() };

beforeEach(() => { try { localStorage.clear(); } catch { /* ok */ } ligar.mockReset(); });

describe("the definition of saldo disponível (lib/saldo.ts)", () => {
  it("Rick's example: recent 1.113,29, unconfirmed 218,18, PARCIAL", () => {
    const c = consolidar(exemplo(), conexoesExemplo);
    expect(c.recente).toBeCloseTo(1113.29, 2);
    expect(c.semConfirmacao).toBeCloseTo(218.18, 2);
    expect(c).toMatchObject({ parcial: true, qtdSemConfirmacao: 1, qtdDesconectadas: 1, qtdIndisponiveis: 0 });
    expect(c.partes.trabalho.recente).toBeCloseTo(612.3, 2);
  });
  it("all disconnected: no recent money (null, not zero), last known apart", () => {
    const c = consolidar(exemplo(), conexoesExemplo.map((x) => ({ ...x, status: "WAITING_USER_INPUT" })));
    expect(c.recente).toBeNull();
    expect(c.semConfirmacao).toBeCloseTo(1331.47, 2);
    expect(c.qtdDesconectadas).toBe(3);
  });
  it("all outdated (good status, old read): same, never counted as recent", () => {
    const c = consolidar(exemplo(), conexoesExemplo.map((x) => ({ ...x, status: "UPDATED", last_synced_at: velho })));
    expect(c.recente).toBeNull();
    expect(c.qtdSemConfirmacao).toBe(3);
    expect(c.qtdDesconectadas).toBe(0);
  });
  it("an outdated NEGATIVE balance stays negative in the unconfirmed sum", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 300 }, { id: "b", banco: "B", papel: "pessoal", saldo: -120 }] }),
      [conexao({ id: "a" }), conexao({ id: "b", papel: "pessoal", last_synced_at: velho })]);
    expect(c.recente).toBe(300);
    expect(c.semConfirmacao).toBe(-120);
  });
  it("partial sum equal to zero is R$ 0 AND partial", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 0 }, { id: "b", banco: "B", papel: "pessoal", saldo: 90 }] }),
      [conexao({ id: "a" }), conexao({ id: "b", papel: "pessoal", status: "USER_INPUT_TIMEOUT" })]);
    expect(c.recente).toBe(0);
    expect(c.parcial).toBe(true);
  });
  it("really zero: R$ 0, complete", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 0 }] }), [conexao({ id: "a" })]);
    expect(c.recente).toBe(0);
    expect(c.parcial).toBe(false);
  });
  it("no balance sent: unavailable, out of both sums", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: null }] }), [conexao({ id: "a" })]);
    expect(c).toMatchObject({ recente: null, semConfirmacao: null, qtdIndisponiveis: 1, parcial: true });
  });
  it("connections not loaded: nothing is claimed; connections unreadable: nothing is recent", () => {
    expect(consolidar(exemplo(), null).conferido).toBe(false);
    expect(consolidar(exemplo(), []).recente).toBeNull();
  });
  it("one connection without a role counts as work, like financas_home()", () => {
    expect(agrupar(exemplo({ contas: [{ id: "a", banco: "A", papel: null, saldo: 5 }] }), []).trabalho).toHaveLength(1);
  });
  it("no bar when a side is negative, or when there is only one side", () => {
    const neg = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: -50 }, { id: "g", banco: "G", papel: "pessoal", saldo: 300 }] }),
      [conexao({ id: "a" }), conexao({ id: "g", papel: "pessoal" })]);
    expect(distribuicao(neg)).toBeNull();
    expect(distribuicao(consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 50 }] }), [conexao({ id: "a" })]))).toBeNull();
  });
  it("the same bank twice is a fact, not a duplicate", () => {
    expect([...bancosRepetidos([{ banco: "Banco A" }, { banco: "banco a" }])]).toEqual(["banco a"]);
  });
  it("zero is R$ 0, missing is 'indisponível', hidden is masked", () => {
    expect(so(dinheiro(0, false))).toBe("R$ 0");
    expect(dinheiro(null, false)).toBe("indisponível");
    expect(dinheiro(10, true)).toBe("R$ •••••");
  });
  it("groups and organisation keep their rules", () => {
    expect(totalDoGrupo([{ id: "a", banco: "A", saldo: null, conexao: null }])).toBeNull();
    expect(linhasDaOrganizacao(painel())).toMatchObject({ guardado: { valor: 2000 }, cartao: { valor: 450 }, dividas: { valor: 120 } });
  });
});

describe("the cards", () => {
  it("Bancos: recent money big, PARCIAL, unconfirmed line with the date", () => {
    render(<SaldoDisponivel c={consolidar(exemplo(), conexoesExemplo)} oculto={false} onOcultar={vi.fn()} />);
    expect(screen.getByText("PARCIAL")).toBeTruthy();
    expect(so(screen.getByText(/1\.113,29/).textContent)).toBe("R$ 1.113,29");
    expect(so(screen.getByText(/Sem confirmação recente/).textContent)).toMatch(/R\$ 218,18 · 1 banco desconectado desde \d\d\/\d\d/);
  });
  it("nothing recent: 'Saldo atual indisponível' (never R$ 0) and the last known value apart", () => {
    render(<SaldoDisponivel c={consolidar(exemplo(), conexoesExemplo.map((x) => ({ ...x, status: "WAITING_USER_INPUT" })))} oculto={false} onOcultar={vi.fn()} />);
    expect(screen.getByText("Saldo atual indisponível")).toBeTruthy();
    expect(screen.queryByText("R$ 0")).toBeNull();
    expect(screen.getByText(/Último saldo conhecido/)).toBeTruthy();
    expect(screen.queryByText("PARCIAL")).toBeNull();
  });
  it("partial zero shows R$ 0 with PARCIAL; real zero shows R$ 0 'Atualizado'", () => {
    const { unmount } = render(<SaldoDisponivel c={consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 0 }, { id: "b", banco: "B", papel: "pessoal", saldo: 90 }] }),
      [conexao({ id: "a" }), conexao({ id: "b", papel: "pessoal", status: "USER_INPUT_TIMEOUT" })])} oculto={false} onOcultar={vi.fn()} />);
    expect(screen.getByText("PARCIAL")).toBeTruthy();
    unmount();
    render(<SaldoDisponivel c={consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: 0 }] }), [conexao({ id: "a" })])} oculto={false} onOcultar={vi.fn()} />);
    expect(screen.queryByText("PARCIAL")).toBeNull();
    expect(screen.getByText(/^Atualizado às/)).toBeTruthy();
  });
  it("Resumo and Bancos show the SAME number and the same lines", () => {
    const c = consolidar(exemplo(), conexoesExemplo);
    const { container: bancos } = render(<SaldoDisponivel c={c} oculto={false} onOcultar={vi.fn()} />);
    const { container: resumo } = render(<DinheiroDisponivel h={exemplo()} c={c} onVerBancos={vi.fn()} />);
    const numero = (el: HTMLElement) => so([...el.querySelectorAll("p")].find((p) => so(p.textContent) === "R$ 1.113,29")?.textContent ?? null);
    expect(numero(bancos)).toBe("R$ 1.113,29");
    expect(numero(resumo)).toBe("R$ 1.113,29");
    expect(so(bancos.textContent)).toContain("Sem confirmação recente: R$ 218,18");
    expect(so(resumo.textContent)).toContain("Sem confirmação recente: R$ 218,18");
  });
  it("Resumo: a recent negative balance turns the card red; the bar is not drawn", () => {
    const c = consolidar(exemplo({ causas: [{ descricao: "Aluguel", categoria: "casa", valor: 900, data: "2026-11-27" }],
      contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: -400 }, { id: "g", banco: "G", papel: "pessoal", saldo: 80 }] }),
      [conexao({ id: "a" }), conexao({ id: "g", papel: "pessoal" })]);
    render(<DinheiroDisponivel h={exemplo({ causas: [{ descricao: "Aluguel", categoria: "casa", valor: 900, data: "2026-11-27" }] })} c={c} onVerBancos={vi.fn()} />);
    expect(screen.getByText("Você está no negativo")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("group: total is recent money only; the unconfirmed one is labelled, in grey", () => {
    const c = consolidar(exemplo(), conexoesExemplo);
    render(<GrupoContas tipo="trabalho" linhas={c.contas.filter((x) => x.papel === "trabalho")} {...grupo} />);
    expect(so(screen.getAllByText(/612,30/)[0]!.textContent)).toBe("R$ 612,30");
    expect(so(screen.getByText(/sem confirmação$/).textContent)).toBe("+ R$ 218,18 sem confirmação");
    expect(screen.getByText("DESCONECTADO")).toBeTruthy();
    expect(screen.getByText("Autorizar de novo no app do banco")).toBeTruthy();
  });
  it("a connection that sent no balance is SEM SALDO, never ATIVO", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "A", papel: "trabalho", saldo: null }] }), [conexao({ id: "a" })]);
    render(<GrupoContas tipo="trabalho" linhas={c.contas} {...grupo} />);
    expect(screen.getByText("SEM SALDO")).toBeTruthy();
    expect(screen.queryByText("ATIVO")).toBeNull();
  });
  it("two connections of one bank: neutral note, no duplicate claim", () => {
    const c = consolidar(exemplo({ contas: [{ id: "a", banco: "Banco A", papel: "trabalho", saldo: 1 }, { id: "b", banco: "Banco A", papel: "pessoal", saldo: 2 }] }),
      [conexao({ id: "a" }), conexao({ id: "b", papel: "pessoal" })]);
    render(<GrupoContas tipo="trabalho" linhas={c.contas.filter((x) => x.papel === "trabalho")} {...grupo} repetidos={bancosRepetidos(c.contas)} />);
    expect(screen.getByText("outra conexão deste banco")).toBeTruthy();
    expect(screen.queryByText(/duplic/i)).toBeNull();
  });
});

describe("Pro without a bank and Essencial", () => {
  it("Pro without a bank: the empty state, and the CTA is the existing connect flow", () => {
    render(<PrimeiroBanco />);
    expect(screen.getByText("Todo o seu dinheiro em um só lugar.")).toBeTruthy();
    expect(screen.getByText(/Conecte seu primeiro banco e acompanhe seus saldos, despesas, cartões e investimentos automaticamente\./)).toBeTruthy();
    expect(screen.getByText("Conexão segura via Open Finance")).toBeTruthy();
    fireEvent.click(screen.getByText("Conectar meu primeiro banco"));
    expect(ligar).toHaveBeenCalledWith();
  });
  it("the tab: Pro without a bank can open Bancos; Essencial keeps the locked tab; nobody else", () => {
    expect(abaValida("bancos", false, false, true)).toBe("bancos");
    expect(abaValida("bancos", false, true, false)).toBe("bancos");
    expect(abaValida("bancos", false, false, false)).toBe("resumo");
    expect(abaValida("bancos", true)).toBe("bancos");
  });
});

describe("privacy", () => {
  it("hidden: no digit of money anywhere on the screen, and the bar says nothing", () => {
    const c = consolidar(exemplo(), conexoesExemplo);
    const { container } = render(<>
      <SaldoDisponivel c={c} oculto onOcultar={vi.fn()} />
      <GrupoContas tipo="trabalho" linhas={c.contas.filter((x) => x.papel === "trabalho")} {...grupo} oculto />
      <OrganizacaoFinanceira p={painel()} oculto abrir={vi.fn()} />
    </>);
    expect(so(container.textContent)).not.toMatch(/R\$ ?−? ?\d/);
    expect(container.querySelector('[aria-label*="%"]')).toBeNull();
  });
  it("drawers: amounts are masked in the text itself (nothing behind a blur), titles stay", () => {
    for (const aba of ["cartao", "dividas", "guardado"] as const) {
      const { unmount } = render(<PainelGaveta p={painel()} aba={aba} onFechar={vi.fn()} oculto />);
      const texto = so(document.body.textContent);
      expect(texto).not.toMatch(/R\$ ?\d/);
      expect(texto).toContain("R$ •••••");
      expect(document.querySelector('[style*="blur"]')).toBeNull();
      unmount();
    }
  });
  it("drawers shown normally when values are visible", () => {
    render(<PainelGaveta p={painel()} aba="cartao" onFechar={vi.fn()} />);
    expect(so(document.body.textContent)).toMatch(/R\$ 450/);
  });
  it("the choice is per account and starts clean for another account on the same phone", () => {
    const { result, rerender } = renderHook(({ u }) => useOcultarValores(u), { initialProps: { u: "conta-a" } });
    act(() => result.current.alternar());
    expect(result.current.oculto).toBe(true);
    rerender({ u: "conta-b" });
    expect(result.current.oculto).toBe(false);
    rerender({ u: "conta-a" });
    expect(result.current.oculto).toBe(true);
    expect(Object.keys(localStorage).some((k) => k.startsWith("orbis_") && k.includes("conta-a"))).toBe(true);
  });
});
