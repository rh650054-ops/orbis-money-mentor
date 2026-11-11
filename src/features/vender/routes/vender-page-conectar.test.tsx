// A1 — the three places a vendor starts a bank connection from, and what each one asks for.
// SIMULATED: the connection hook is a stand-in; this checks only the wiring of the screen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { estado, mutacao } = vi.hoisted(() => ({
  estado: { bancos: [] as Record<string, unknown>[], ligar: null as unknown as ReturnType<typeof import("vitest")["vi"]["fn"]>, ligando: false, precisaExtra: false },
  mutacao: () => ({ mutate: () => undefined, mutateAsync: () => undefined, isPending: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({ supabase: {}, createQueryKeys: (f: string) => ({ all: [f], byUser: (u: string) => [f, u] }) }));
vi.mock("@/features/renovacao", () => ({ AvisoRenovacaoPix: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", email: "r@v.com" } }) }));
vi.mock("@/components/ranking/AvatarRanking", () => ({ SeloVerificado: () => null }));
vi.mock("@/components/conectar/PapelContas", () => ({ BancoExtra: () => <p>OFERTA DE BANCO EXTRA</p>, avisoPapel: () => true }));
vi.mock("@/components/conectar/comprovante-renda", () => ({ gerarComprovante: vi.fn(), baixarComprovantePDF: vi.fn() }));
vi.mock("../api/use-leitura-ao-abrir", () => ({ useLeituraAoAbrir: () => undefined }));
vi.mock("../api/use-retorno-do-banco", () => ({ useRetornoDoBanco: () => undefined }));
vi.mock("../api/use-ligar-banco", () => ({ useLigarBanco: () => ({ ligar: estado.ligar, ligando: estado.ligando, precisaExtra: estado.precisaExtra, fecharExtra: () => undefined }) }));
vi.mock("../api/use-vender-mutations", () => ({ useAtualizarAgoraMutation: mutacao, usePapelMutation: mutacao, useDesligarMutation: mutacao }));
vi.mock("../api/use-bancos-query", () => ({
  useBancosQuery: () => ({ isLoading: false, refetch: () => Promise.resolve({ data: null }),
    data: { pro: { pro: true, origem: "hotmart", ate: null, bancos: estado.bancos.length, verificado: false }, bancos: estado.bancos, contas: [], cobraPix: false } }),
}));
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
vi.mock("../api/use-conciliacao-query", () => ({ useConciliacaoQuery: () => ({ data: { hoje, tem_banco: true, ultima_leitura: null, dias: [] } }) }));

import VenderPage from "./vender-page";

const banco = (id: string, status: string) => ({ id, item_id: `item-${id}`, institution_name: `Banco ${id}`, institution_logo: null, status, last_synced_at: new Date().toISOString(), papel: "trabalho" });
const abrir = () => render(<MemoryRouter><VenderPage /></MemoryRouter>);

beforeEach(() => { estado.bancos = []; estado.ligar = vi.fn(); estado.ligando = false; estado.precisaExtra = false; });

describe("vender · starting a bank connection", () => {
  it("first bank: 'Ligar meu banco' asks for a NEW connection", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Ligar meu banco/ }));
    expect(estado.ligar).toHaveBeenCalledTimes(1);
    expect(estado.ligar).toHaveBeenCalledWith();
  });

  it("first bank while it is opening: the button says so and cannot be tapped again", () => {
    estado.ligando = true;
    abrir();
    const botao = screen.getByRole("button", { name: /Abrindo/ });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(estado.ligar).not.toHaveBeenCalled();
  });

  it("first bank without a slot: the extra-bank offer shows here too (it used to show nothing)", () => {
    estado.precisaExtra = true;
    abrir();
    expect(screen.getByText("OFERTA DE BANCO EXTRA")).toBeInTheDocument();
  });

  it("second bank: 'Ligar outro banco' asks for a NEW connection", () => {
    estado.bancos = [banco("a", "UPDATED")];
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Ligar outro banco/ }));
    expect(estado.ligar).toHaveBeenCalledWith();
  });

  it("a bank waiting for the vendor: 'Autorizar' asks to reauthorise THAT item, not a new connection", () => {
    estado.bancos = [banco("a", "UPDATED"), banco("b", "WAITING_USER_INPUT")];
    abrir();
    const botoes = screen.getAllByRole("button", { name: "Autorizar" });
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]!);
    expect(estado.ligar).toHaveBeenCalledWith("item-b");
  });

  it("a bank that is merely out (OUTDATED): no 'Autorizar' — it is not the vendor's turn", () => {
    estado.bancos = [banco("a", "OUTDATED")];
    abrir();
    expect(screen.queryByRole("button", { name: "Autorizar" })).toBeNull();
  });

  it("while a connection is opening, neither 'Autorizar' nor 'Ligar outro banco' can start another", () => {
    estado.bancos = [banco("a", "UPDATED"), banco("b", "LOGIN_ERROR")];
    estado.ligando = true;
    abrir();
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Ligar outro banco/ })).toBeDisabled();
  });
});
