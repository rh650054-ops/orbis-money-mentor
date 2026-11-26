vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const conferir = vi.hoisted(() => vi.fn());
const externo = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/caminho-assinatura", async (orig) => ({ ...(await orig<typeof import("@/shared/lib/caminho-assinatura")>()), conferirNaHotmart: conferir }));
vi.mock("@/shared/lib/link-externo", () => ({ abrirLinkExterno: externo }));
vi.mock("./renovar-pix", () => ({ RenovarPix: ({ titulo }: { titulo?: string }) => <p>PIX {titulo}</p> }));
import { RegularizarAssinatura } from "./regularizar-assinatura";

const atrasada = { acao: "regularizar" as const, plano: "VANT Essencial", assinatura: "S1", oferta: "8qbxvm9p" };

describe("Regularizar assinatura (26/11)", () => {
  it("overdue by card: pays at Hotmart's area (no new checkout); 'Já paguei' releases when Hotmart confirms", async () => {
    const liberado = vi.fn();
    conferir.mockResolvedValue({ liberado: true, caminho: { acao: "em_dia" } });
    render(<RegularizarAssinatura caminho={atrasada} pix={null} onLiberado={liberado} />);
    expect(screen.getByText("Seu pagamento está atrasado")).toBeInTheDocument();
    expect(screen.getByText(/Não precisa criar outra assinatura nem outra conta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pagar na Hotmart" }));
    expect(externo).toHaveBeenCalledWith("https://consumer.hotmart.com/purchase");
    fireEvent.click(screen.getByRole("button", { name: "Já paguei, conferir" }));
    await waitFor(() => expect(liberado).toHaveBeenCalled());
  });
  it("overdue by Pix: the open Pix is shown instead of a button", () => {
    render(<RegularizarAssinatura caminho={atrasada} pix={{ subscription_id: "S1" } as never} onLiberado={vi.fn()} />);
    expect(screen.getByText(/PIX Pague o Pix da sua renovação/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar na Hotmart" })).toBeNull();
  });
  it("still unpaid: says so, nothing released", async () => {
    conferir.mockResolvedValue({ liberado: false, caminho: atrasada });
    render(<RegularizarAssinatura caminho={atrasada} pix={null} onLiberado={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Já paguei, conferir" }));
    expect(await screen.findByText(/ainda não confirmou o pagamento/)).toBeInTheDocument();
  });
  it("Hotmart says the old subscription is closed: a new checkout is offered", async () => {
    const nova = vi.fn();
    conferir.mockResolvedValue({ liberado: false, caminho: { acao: "nova" } });
    render(<RegularizarAssinatura caminho={atrasada} pix={null} onLiberado={vi.fn()} onNovaAssinatura={nova} />);
    fireEvent.click(screen.getByRole("button", { name: "Já paguei, conferir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar para o pagamento" }));
    expect(nova).toHaveBeenCalled();
  });
  it("paid at Hotmart but blocked here: checks on its own when it opens", async () => {
    const liberado = vi.fn();
    conferir.mockResolvedValue({ liberado: true, caminho: { acao: "em_dia" } });
    render(<RegularizarAssinatura caminho={{ ...atrasada, acao: "conciliar" }} pix={null} onLiberado={liberado} />);
    await waitFor(() => expect(liberado).toHaveBeenCalled());
  });
  it("already active: nothing to pay, shows the next charge", () => {
    render(<RegularizarAssinatura caminho={{ ...atrasada, acao: "em_dia", proxima_cobranca: "2026-12-20T15:00:00Z" }} pix={null} onLiberado={vi.fn()} />);
    expect(screen.getByText(/Não precisa pagar de novo. A próxima cobrança é em 20\/12\/2026/)).toBeInTheDocument();
  });
});
