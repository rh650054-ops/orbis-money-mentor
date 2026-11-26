/* "Gerar Pix" (26/11): the regularize screen with the Pix of the pending monthly fee.
   The button is OFF in production (VITE_GERAR_PIX unset): then the screen is exactly today's. */
const sb = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: sb.rpc, functions: { invoke: sb.invoke } } }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const conferir = vi.hoisted(() => vi.fn());
const externo = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/caminho-assinatura", async (orig) => ({ ...(await orig<typeof import("@/shared/lib/caminho-assinatura")>()), conferirNaHotmart: conferir }));
vi.mock("@/shared/lib/link-externo", () => ({ abrirLinkExterno: externo }));
import { lerRespostaGerarPix } from "../api/use-gerar-pix";
import { RegularizarAssinatura } from "./regularizar-assinatura";

const PIX = "00020126580014br.gov.bcb.pix0136chave-ficticia-de-teste-0000000000005204000053039865405029.905802BR5905TESTE6009SAO PAULO6304ABCD";
const atrasada = { acao: "regularizar" as const, plano: "Vant Pro", assinatura: "S1", oferta: "5y86n311", valor: 29.9 };
const gerado = { acao: "gerado", pix_code: PIX, pix_qrcode: "https://exemplo.com/qr", vence_em: new Date(Date.now() + 2 * 86_400_000).toISOString(), valor: 29.9, recorrencia: 3 };

function tela(props: Partial<Parameters<typeof RegularizarAssinatura>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RegularizarAssinatura caminho={atrasada} pix={null} userId="u1" onLiberado={vi.fn()} {...props} /></QueryClientProvider>);
}

beforeEach(() => { sb.rpc.mockReset().mockResolvedValue({ data: null, error: null }); sb.invoke.mockReset(); conferir.mockReset(); externo.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("Gerar Pix desligado (produção hoje)", () => {
  it("a tela é a de hoje: sem botão Gerar Pix, sem chamada nenhuma", () => {
    tela();
    expect(screen.getByText("Seu pagamento está atrasado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar na Hotmart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já paguei, conferir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar Pix/ })).toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(sb.invoke).not.toHaveBeenCalled();
  });
});

describe("Gerar Pix ligado", () => {
  beforeEach(() => vi.stubEnv("VITE_GERAR_PIX", "1"));

  it("mostra o plano, a mensalidade pendente e o botão; nada é pedido à Hotmart antes do toque", async () => {
    tela();
    expect(screen.getByText("Regularize sua assinatura")).toBeInTheDocument();
    expect(screen.getByText("VANT PRO")).toBeInTheDocument();
    expect(screen.getByText("Pagamento pendente")).toBeInTheDocument();
    expect(screen.getByText("Mensalidade Vant Pro")).toBeInTheDocument();
    expect(screen.getByText("R$ 29,90")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar Pix" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já paguei, verificar pagamento" })).toBeInTheDocument();
    expect(sb.invoke).not.toHaveBeenCalled();
  });

  it("toque → carregando (dois toques = um pedido) → QR Code, copiar código e vencimento", async () => {
    let soltar: (v: unknown) => void = () => {};
    sb.invoke.mockReturnValue(new Promise((r) => { soltar = r; }));
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    const carregando = await screen.findByRole("button", { name: "Gerando seu Pix…" });
    expect(carregando).toBeDisabled();
    fireEvent.click(carregando);
    expect(sb.invoke).toHaveBeenCalledTimes(1);
    expect(sb.invoke).toHaveBeenCalledWith("hotmart-negociar", { body: {} });
    soltar({ data: gerado, error: null });
    expect(await screen.findByLabelText("QR Code do Pix")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código Pix" })).toBeInTheDocument();
    expect(screen.getByText("Mensalidade pendente")).toBeInTheDocument();
    expect(screen.getByText(/vence dia|vence amanhã/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar Pix" })).toBeNull();
  });

  it("Pix já gerado e ainda válido: aparece direto, sem pedir outro", async () => {
    sb.rpc.mockResolvedValue({ data: { pix_code: PIX, vence_em: gerado.vence_em, valor: 29.9 }, error: null });
    tela();
    expect(await screen.findByRole("button", { name: "Copiar código Pix" })).toBeInTheDocument();
    expect(sb.rpc).toHaveBeenCalledWith("hotmart_negociacao_minha");
    expect(sb.invoke).not.toHaveBeenCalled();
  });

  it("o servidor devolve o Pix que já existia (reutilizar / pix_existente): mostra esse", async () => {
    sb.invoke.mockResolvedValue({ data: { ...gerado, acao: "reutilizar" }, error: null });
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    expect(await screen.findByRole("button", { name: "Copiar código Pix" })).toBeInTheDocument();
  });

  it.each([
    ["em_andamento", undefined, /já está sendo gerado/, false],
    ["falhou", undefined, /não gerou o Pix agora/, true],
    ["incerto", undefined, /Para você não pagar duas vezes/, true],
    ["recusar", "pix_automatico", /Pix Automático/, true],
    ["recusar", "titular_nao_confere", /Não deu para gerar o Pix por aqui/, true],
  ])("sem Pix (%s %s): diz o que houve e, quando cabe, oferece a Hotmart", async (acao, motivo, texto, hotmart) => {
    sb.invoke.mockResolvedValue({ data: { acao, motivo }, error: null });
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(texto);
    expect(!!screen.queryByRole("button", { name: "Pagar na Hotmart" })).toBe(hotmart);
    expect(screen.queryByLabelText("QR Code do Pix")).toBeNull();
  });

  it("função fora do ar ou porta fechada no servidor: erro claro, sem Pix inventado", async () => {
    sb.invoke.mockResolvedValue({ data: null, error: new Error("403") });
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não deu para gerar o Pix por aqui/);
    fireEvent.click(screen.getByRole("button", { name: "Pagar na Hotmart" }));
    expect(externo).toHaveBeenCalledWith("https://consumer.hotmart.com/purchase");
  });

  it("assinatura encerrada na Hotmart: confere e oferece Assinar novamente (checkout atual)", async () => {
    const nova = vi.fn();
    sb.invoke.mockResolvedValue({ data: { acao: "recusar", motivo: "encerrada" }, error: null });
    conferir.mockResolvedValue({ liberado: false, caminho: { acao: "nova" } });
    tela({ onNovaAssinatura: nova });
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    fireEvent.click(await screen.findByRole("button", { name: "Assinar novamente" }));
    expect(nova).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Já paguei, verificar pagamento: libera quando o pagamento foi confirmado", async () => {
    const liberado = vi.fn();
    conferir.mockResolvedValue({ liberado: true, caminho: { acao: "em_dia" } });
    tela({ onLiberado: liberado });
    fireEvent.click(screen.getByRole("button", { name: "Já paguei, verificar pagamento" }));
    await waitFor(() => expect(liberado).toHaveBeenCalled());
  });

  it("com o Pix na tela, voltar do app do banco verifica sozinho (sem aviso se ainda não caiu)", async () => {
    sb.invoke.mockResolvedValue({ data: gerado, error: null });
    conferir.mockResolvedValue({ liberado: false, caminho: atrasada, limitado: true });
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    await screen.findByLabelText("QR Code do Pix");
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(conferir).toHaveBeenCalled());
    expect(screen.queryByText(/Espere 1 minuto/)).toBeNull();
  });

  it("página /assinar aberta pelo app da loja: pede com o token, sem ler a sessão", async () => {
    sb.invoke.mockResolvedValue({ data: gerado, error: null });
    tela({ token: "tok-de-30-minutos-000000", userId: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
    await screen.findByLabelText("QR Code do Pix");
    expect(sb.invoke).toHaveBeenCalledWith("hotmart-negociar", { body: { t: "tok-de-30-minutos-000000" } });
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it("resposta malformada nunca vira um Pix na tela", () => {
    expect(lerRespostaGerarPix({ acao: "gerado" })).toEqual({ acao: "indisponivel", pix: null });
    expect(lerRespostaGerarPix({ acao: "gerado", pix_code: "curto" })).toEqual({ acao: "indisponivel", pix: null });
    expect(lerRespostaGerarPix(null)).toEqual({ acao: "indisponivel", pix: null });
    expect(lerRespostaGerarPix({ acao: "incerto", pix_code: PIX }).pix).toBeNull();
  });
});
