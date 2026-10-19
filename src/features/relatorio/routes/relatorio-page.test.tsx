import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { relatorioExemplo } from "../lib/exemplo";

// jsdom has no matchMedia; the motion helpers ask it about reduced motion.
Object.defineProperty(window, "matchMedia", { writable: true, value: (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false }) });

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn(async () => ({ data: null, error: null })) } }));
vi.mock("@/shared/api", () => ({ supabase: { functions: { invoke: vi.fn() } }, createQueryKeys: (f: string) => ({ all: [f], list: (x: unknown) => [f, "list", x] }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/shared/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/FirstTimeCard", () => ({ default: () => null }));
vi.mock("@/components/jornada/useJornada", () => ({ useMarcarPasso: () => undefined }));
vi.mock("@/components/relatorio/ConferenciaBanco", () => ({ ConferenciaBanco: () => null, useConferenciaBanco: () => [] }));
vi.mock("@/components/relatorio/FechamentoDoDia", () => ({ FechamentoDoDia: () => <div>fechamento</div> }));
vi.mock("@/components/defcon/DefconShareCarousel", () => ({ DefconShareCarousel: () => <div>arte do dia</div> }));
vi.mock("@/components/relatorio/RelatorioShareCard", () => ({ RelatorioShareCard: () => <div>arte recap</div> }));
vi.mock("@/components/relatorio/recapCanvas", () => ({ fmtHorasCurto: (m: number) => `${m}min` }));
vi.mock("@/utils/reportExport", () => ({ generateAndDownloadReport: vi.fn(async () => 6) }));
vi.mock("../api/use-relatorio-query", () => ({
  relatorioKeys: { all: ["relatorio"] },
  useRelatorioQuery: () => ({ data: relatorioExemplo(), isPending: false, isError: false, error: null, refetch: vi.fn() }),
  useCaloteBancoQuery: () => ({ data: null }),
  useGastosBancoQuery: () => ({ data: null }),
}));

import RelatorioPage from "./relatorio-page";

function montar() {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><RelatorioPage /></QueryClientProvider>);
}

describe("Relatório (redesign 18/10)", () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-18T15:00:00-03:00")); });
  afterAll(() => vi.useRealTimers());

  it("abre na semana, com o dinheiro em extrato e cada bloco com a resposta primeiro", () => {
    montar();
    // filtro: Ontem voltou como chip
    expect(screen.getByRole("tab", { name: "Ontem" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Semana" }).getAttribute("aria-selected")).toBe("true");
    // dinheiro: vendeu → caiu → gastou → sobrou (cada um uma vez)
    expect(screen.getAllByText("Vendeu").length).toBeGreaterThan(0);
    expect(screen.getByText("Caiu no bolso")).toBeTruthy();
    expect(screen.getByText("Sobrou pra você")).toBeTruthy();
    expect(screen.getAllByText(/R\$\s3\.141/).length).toBe(1);
    // vendas: conversão sobre os totais
    expect(screen.getByText(/65 de cada 100/)).toBeTruthy();
    // hora a hora por período do dia, com a melhor hora na linha de fato
    expect(screen.getByText("Almoço")).toBeTruthy();
    expect(screen.getByText(/Melhor hora:/)).toBeTruthy();
    // tempo, recebeu, gastos, calote, Vant viu
    expect(screen.getByText("Vendendo")).toBeTruthy();
    expect(screen.getByText("Pix")).toBeTruthy();
    expect(screen.getByText("Seus gastos")).toBeTruthy();
    expect(screen.getByText(/em calote/)).toBeTruthy();
    expect(screen.getByText("Caiu depois")).toBeTruthy();
    expect(screen.getByText("O calote pesou.")).toBeTruthy();
    expect(screen.getByText("arte recap")).toBeTruthy();
  });

  it("gráfico dia a dia: tocar num dia mostra o dia e abre o relatório só dele", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /^13\/10:/ }));
    expect(screen.getByText("Ter 13/10")).toBeTruthy();
    expect(screen.getByText(/16 vendas em 23 abordagens/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Ver o relatório desse dia/));
    expect(screen.getAllByText("terça 13/10").length).toBeGreaterThan(0);
  });

  it("exportar usa o período da tela e oferece PDF, CSV e Excel", () => {
    montar();
    fireEvent.click(screen.getByText(/Exportar 12\/10 → 18\/10/));
    expect(screen.getByText("PDF")).toBeTruthy();
    expect(screen.getByText("Excel")).toBeTruthy();
  });
});
