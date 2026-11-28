import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import type { BancoLigado } from "@/components/conectar/pluggy";
import type { Painel } from "@/components/financas/FinancasPainel";
import { agrupar, totalDoGrupo } from "../lib/contas";
import { dinheiro } from "../lib/ocultar";
import { linhasDaOrganizacao } from "../lib/organizacao";
import { avisosDoSaldo, bancosRepetidos, qualidade } from "../lib/qualidade";
import { renderHook, act } from "@testing-library/react";
import { useOcultarValores } from "../lib/ocultar";
import { PainelGaveta } from "@/components/financas/FinancasPainel";
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
    const { rerender } = render(<SaldoDisponivel h={casa()} oculto={false} onOcultar={ocultar} q={null} semPapel={null} />);
    expect(screen.getByText("R$ 1.000")).toBeTruthy();
    expect(screen.getByRole("img", { name: "70% trabalho, 30% pessoal" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Ocultar valores"));
    expect(ocultar).toHaveBeenCalled();
    rerender(<SaldoDisponivel h={casa()} oculto onOcultar={ocultar} q={null} semPapel={null} />);
    expect(screen.queryByText("R$ 1.000")).toBeNull();
    expect(screen.getAllByText("R$ •••••").length).toBe(3);
  });
  it("no balance from the bank is 'indisponível', not zero", () => {
    render(<SaldoDisponivel h={casa({ tem_saldo: false, saldo: null, atualizado: null })} oculto={false} onOcultar={vi.fn()} q={null} semPapel={null} />);
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

describe("audit 28/11: the total never passes for complete when it is not", () => {
  const velho = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
  const duas = (o: Partial<HomeFinancas>, c: BancoLigado[]) => { const g = agrupar(casa(o), c); return [...g.trabalho, ...g.pessoal, ...g.semPapel]; };

  it("one bank recent, the other with an old read: PARCIAL, with the date of the old balance", () => {
    const q = qualidade(duas({}, [conexao(), conexao({ id: "c2", last_synced_at: velho })]));
    expect(q).toMatchObject({ completo: false, antigas: 1, semSaldo: 0 });
    expect(avisosDoSaldo(q)[0]).toMatch(/^1 banco sem leitura recente: saldo de \d\d\/\d\d$/);
  });
  it("a disconnected bank whose old balance is still in the total says so", () => {
    const q = qualidade(duas({}, [conexao(), conexao({ id: "c2", status: "USER_INPUT_TIMEOUT", last_synced_at: velho })]));
    expect(q.desconectadas).toBe(1);
    expect(avisosDoSaldo(q)[0]).toMatch(/^1 banco desconectado: saldo de/);
  });
  it("one account without a balance: left out of the total, and the screen says it", () => {
    const q = qualidade(duas({ contas: [{ id: "c1", banco: "A", papel: "trabalho", saldo: 700 }, { id: "c2", banco: "B", papel: "pessoal", saldo: null }] },
      [conexao(), conexao({ id: "c2" })]));
    expect(avisosDoSaldo(q)).toEqual(["Sem o saldo de 1 banco: não entra no total"]);
  });
  it("everything recent: complete, no warning", () => {
    const q = qualidade(duas({}, [conexao(), conexao({ id: "c2" })]));
    expect(q.completo).toBe(true);
    expect(avisosDoSaldo(q)).toEqual([]);
  });
  it("no connection data yet is NOT counted as recent", () => {
    expect(qualidade(duas({}, [])).completo).toBe(false);
  });
  it("PARCIAL badge and 'mais recente' time on the card", () => {
    const q = qualidade(duas({}, [conexao(), conexao({ id: "c2", last_synced_at: velho })]));
    render(<SaldoDisponivel h={casa()} oculto={false} onOcultar={vi.fn()} q={q} semPapel={null} />);
    expect(screen.getByText("PARCIAL")).toBeTruthy();
    expect(screen.getByText(/Leitura mais recente às/)).toBeTruthy();
    expect(screen.queryByText(/^Atualizado às/)).toBeNull();
  });
  it("the same bank twice is flagged (second account or a copy after reconnecting)", () => {
    const linhas = duas({ contas: [{ id: "c1", banco: "Banco A", papel: "trabalho", saldo: 1 }, { id: "c2", banco: "banco a", papel: "pessoal", saldo: 2 }] }, []);
    expect([...bancosRepetidos(linhas)]).toEqual(["banco a"]);
    render(<GrupoContas tipo="trabalho" linhas={linhas.slice(0, 1)} {...grupo} repetidos={bancosRepetidos(linhas)} />);
    expect(screen.getByText("conectado 2 vezes")).toBeTruthy();
  });
  it("a group with a missing balance shows its total as parcial", () => {
    const g = agrupar(casa({ contas: [{ id: "c1", banco: "A", papel: "trabalho", saldo: 700 }, { id: "c2", banco: "B", papel: "trabalho", saldo: null }] }), [conexao(), conexao({ id: "c2" })]);
    render(<GrupoContas tipo="trabalho" linhas={g.trabalho} {...grupo} />);
    expect(screen.getByText("parcial")).toBeTruthy();
  });
  it("unclassified money is shown apart, not hidden inside work or personal", () => {
    render(<SaldoDisponivel h={casa({ saldo: 1300, saldo_trabalho: 700, saldo_pessoal: 300 })} oculto={false} onOcultar={vi.fn()} q={null} semPapel={300} />);
    expect(screen.getByRole("img", { name: /sem classificação/ })).toBeTruthy();
    expect(screen.getByText(/em banco sem classificação/)).toBeTruthy();
  });
  it("a negative balance is red with a minus sign (it lowers the total, never adds)", () => {
    render(<SaldoDisponivel h={casa({ saldo: -150 })} oculto={false} onOcultar={vi.fn()} q={null} semPapel={null} />);
    expect(screen.getByText("− R$ 150")).toBeTruthy();
  });
});

describe("audit 28/11: privacy", () => {
  it("hidden: the bar's accessible name does not leak the split", () => {
    render(<SaldoDisponivel h={casa()} oculto onOcultar={vi.fn()} q={null} semPapel={null} />);
    const barra = screen.getByRole("img", { name: "Distribuição oculta" });
    expect(barra.children).toHaveLength(1);   // one neutral segment: the split is not drawn
    expect(screen.queryByText(/R\$ \d/)).toBeNull();
  });
  it("hidden: no digit of money anywhere in groups and organisation", () => {
    const { container } = render(<>
      <GrupoContas tipo="trabalho" linhas={agrupar(casa(), [conexao()]).trabalho} {...grupo} oculto />
      <OrganizacaoFinanceira p={painel()} oculto abrir={vi.fn()} />
    </>);
    expect(container.textContent).not.toMatch(/R\$\s?\d/);
  });
  it("the choice is per account: a second account on the same phone starts with its own", () => {
    const { result, rerender } = renderHook(({ u }) => useOcultarValores(u), { initialProps: { u: "conta-a" } });
    act(() => result.current.alternar());
    expect(result.current.oculto).toBe(true);
    rerender({ u: "conta-b" });
    expect(result.current.oculto).toBe(false);
    rerender({ u: "conta-a" });
    expect(result.current.oculto).toBe(true);
  });
  it("the key starts with orbis_, so signing out clears it", () => {
    const { result } = renderHook(() => useOcultarValores("conta-a"));
    act(() => result.current.alternar());
    expect(Object.keys(localStorage).some((k) => k.startsWith("orbis_") && k.includes("conta-a"))).toBe(true);
  });
});

describe("audit 28/11: the detail drawer with values hidden", () => {
  it("blurs the card screen, hides it from screen readers and offers to show", () => {
    const mostrar = vi.fn();
    render(<PainelGaveta p={painel()} aba="cartao" onFechar={vi.fn()} oculto onMostrar={mostrar} />);
    const botao = screen.getByText("Valores ocultos · Mostrar");
    const conteudo = document.querySelector('[aria-hidden="true"][style*="blur"]');
    expect(conteudo).toBeTruthy();
    fireEvent.click(botao);
    expect(mostrar).toHaveBeenCalled();
  });
  it("shown normally when values are visible", () => {
    render(<PainelGaveta p={painel()} aba="cartao" onFechar={vi.fn()} />);
    expect(screen.queryByText("Valores ocultos · Mostrar")).toBeNull();
  });
});

describe("audit 28/11: details found in the screens", () => {
  it("a connection that answers but sent no balance is SEM SALDO, never ATIVO", () => {
    render(<GrupoContas tipo="trabalho" linhas={agrupar(casa({ contas: [{ id: "c1", banco: "A", papel: "trabalho", saldo: null }] }), [conexao()]).trabalho} {...grupo} />);
    expect(screen.getByText("SEM SALDO")).toBeTruthy();
    expect(screen.queryByText("ATIVO")).toBeNull();
  });
  it("no personal account: the personal side is not drawn as 'indisponível'", () => {
    render(<SaldoDisponivel h={casa({ saldo_pessoal: null })} oculto={false} onOcultar={vi.fn()} q={null} semPapel={300} />);
    expect(screen.queryByText("Pessoal")).toBeNull();
    expect(screen.getByText("Trabalho")).toBeTruthy();
  });
});
