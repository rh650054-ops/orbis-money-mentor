import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import type { BancoLigado } from "@/components/conectar/pluggy";
import type { Painel } from "@/components/financas/FinancasPainel";
import { agrupar, totalDoGrupo } from "../lib/contas";
import { dinheiro } from "../lib/ocultar";
import { linhasDaOrganizacao } from "../lib/organizacao";
import { SaldoDisponivel } from "./saldo-disponivel";
import { GrupoContas } from "./grupo-contas";
import { OrganizacaoFinanceira } from "./organizacao";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } } }));

const agora = new Date().toISOString();
const conexao = (o: Partial<BancoLigado> = {}): BancoLigado => ({
  id: "c1", item_id: "i1", institution_name: "Banco A", institution_logo: null, status: "UPDATED", last_synced_at: agora, papel: "trabalho", ...o,
});
const casa = (o: Partial<HomeFinancas> = {}): HomeFinancas => ({
  tem_banco: true, tem_saldo: true, saldo: 1000, bancos: [], atualizado: agora, fixas_mes: 0, folego_dias: null,
  entrou: 0, saiu: 0, sobrou: 0, alerta: null, causas: null, piloto: { lancamentos: 0, conferir: 0 },
  saldo_trabalho: 700, saldo_pessoal: 300,
  contas: [{ id: "c1", banco: "Banco A", papel: "trabalho", saldo: 700 }, { id: "c2", banco: "Banco B", papel: "pessoal", saldo: 300 }], ...o,
});
const painel = (o: Partial<Painel> = {}): Painel => ({
  tem_cartao: true, cartoes: [{ banco: "A", nome: "Cartão", fatura: 450, limite: 1000, disponivel: 550, vence: null, minimo: null }],
  parcelas: [], parcelas_por_mes: [], parcelas_mes: 0, parcelas_total: 0,
  tem_emprestimo: false, emprestimos: [], especial_usado: 120, especial_limite: 500, juros_mes: { emprestimo: 0, especial: 9.6 },
  tem_investimento: true, investimentos: [], guardado: 2000, reserva: 800, saldo_contas: 1000, dividas: 570, dia_de_rua: 200, leitura: null, ...o,
});
const grupo = { oculto: false, ligando: false, onAbrir: vi.fn(), onAutorizar: vi.fn() };

beforeEach(() => { try { localStorage.clear(); } catch { /* ok */ } });

describe("rules", () => {
  it("zero is R$ 0, missing is 'indisponível'", () => {
    expect(dinheiro(0, false).replace(/\s/g, " ")).toBe("R$ 0");
    expect(dinheiro(null, false)).toBe("indisponível");
    expect(dinheiro(null, true)).toBe("indisponível");
    expect(dinheiro(10, true)).toBe("R$ •••••");
  });
  it("one connection without a role counts as work, like financas_home()", () => {
    const g = agrupar(casa({ contas: [{ id: "c1", banco: "A", papel: null, saldo: 5 }] }), []);
    expect(g.trabalho).toHaveLength(1);
  });
  it("two connections without a role stay unclassified", () => {
    const g = agrupar(casa({ contas: [{ id: "c1", banco: "A", papel: null, saldo: 5 }, { id: "c2", banco: "B", papel: null, saldo: 5 }] }), []);
    expect(g.semPapel).toHaveLength(2);
  });
  it("a group total is null only when no balance came", () => {
    expect(totalDoGrupo([{ id: "a", banco: "A", saldo: null, conexao: null }])).toBeNull();
    expect(totalDoGrupo([{ id: "a", banco: "A", saldo: null, conexao: null }, { id: "b", banco: "B", saldo: 0, conexao: null }])).toBe(0);
  });
  it("savings are shown apart: the reserve is inside 'guardado', never added to the balance", () => {
    const l = linhasDaOrganizacao(painel());
    expect(l.guardado.valor).toBe(2000);
    expect(l.cartao.valor).toBe(450);
    expect(l.dividas.valor).toBe(120);
  });
});

describe("Saldo disponível", () => {
  it("shows the total, the time and the split; the eye hides every value", () => {
    const ocultar = vi.fn();
    const { rerender } = render(<SaldoDisponivel h={casa()} oculto={false} onOcultar={ocultar} />);
    expect(screen.getByText("R$ 1.000")).toBeTruthy();
    expect(screen.getByRole("img", { name: "70% trabalho, 30% pessoal" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Ocultar valores"));
    expect(ocultar).toHaveBeenCalled();
    rerender(<SaldoDisponivel h={casa()} oculto onOcultar={ocultar} />);
    expect(screen.queryByText("R$ 1.000")).toBeNull();
    expect(screen.getAllByText("R$ •••••").length).toBe(3);
  });
  it("no balance from the bank is 'indisponível', not zero", () => {
    render(<SaldoDisponivel h={casa({ tem_saldo: false, saldo: null, atualizado: null })} oculto={false} onOcultar={vi.fn()} />);
    expect(screen.getByText("Saldo indisponível")).toBeTruthy();
    expect(screen.queryByText("R$ 0")).toBeNull();
  });
});

describe("account groups and the connection state", () => {
  it("ATIVO only with a recent read and a good status", () => {
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa(), [conexao()]).trabalho} {...grupo} />);
    expect(screen.getByText("ATIVO")).toBeTruthy();
  });
  it("an old read is ATENÇÃO, not ATIVO", () => {
    const velho = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa(), [conexao({ last_synced_at: velho })]).trabalho} {...grupo} />);
    expect(screen.queryByText("ATIVO")).toBeNull();
    expect(screen.getByText("ATENÇÃO")).toBeTruthy();
  });
  it("without connection data it says so instead of looking healthy", () => {
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa(), []).trabalho} {...grupo} />);
    expect(screen.getByText("SEM DADOS")).toBeTruthy();
  });
  it("a disconnected bank offers Autorizar with its item", () => {
    const onAutorizar = vi.fn();
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa(), [conexao({ status: "WAITING_USER_INPUT" })]).trabalho} {...grupo} onAutorizar={onAutorizar} />);
    expect(screen.getByText("DESCONECTADO")).toBeTruthy();
    fireEvent.click(screen.getByText("Autorizar de novo no app do banco"));
    expect(onAutorizar).toHaveBeenCalledWith("i1");
  });
  it("tapping a bank opens its details", () => {
    const onAbrir = vi.fn();
    render(<GrupoContas tipo="pessoal" linhas={agrupar(casa(), [conexao({ id: "c2", papel: "pessoal" })]).pessoal} {...grupo} onAbrir={onAbrir} />);
    fireEvent.click(screen.getByLabelText("Detalhes de Banco B"));
    expect(onAbrir).toHaveBeenCalled();
  });
  it("an account balance the bank did not send is 'indisponível'", () => {
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa({ contas: [{ id: "c1", banco: "A", papel: "trabalho", saldo: null }] }), [conexao()]).trabalho} {...grupo} />);
    expect(screen.getAllByText("indisponível").length).toBe(2);
  });
});

describe("Organização financeira", () => {
  it("each row opens the same drawer as before", () => {
    const abrir = vi.fn();
    render(<OrganizacaoFinanceira p={painel()} oculto={false} abrir={abrir} />);
    fireEvent.click(screen.getByText("Cartões"));
    fireEvent.click(screen.getByText("Dinheiro guardado"));
    fireEvent.click(screen.getByText("Dívidas"));
    expect(abrir.mock.calls.map((c) => c[0])).toEqual(["cartao", "guardado", "dividas"]);
  });
  it("a card the bank did not release shows no zero", () => {
    render(<OrganizacaoFinanceira p={painel({ tem_cartao: false, cartoes: [] })} oculto={false} abrir={vi.fn()} />);
    expect(screen.getByText("o banco não liberou")).toBeTruthy();
  });
});
