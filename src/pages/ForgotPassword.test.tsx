import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
import ForgotPassword from "./ForgotPassword";

const TOKEN = "a".repeat(64);
const tela = () => render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
const digitar = (label: RegExp | string, valor: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

describe("esqueci minha senha (código)", () => {
  beforeEach(() => invoke.mockReset());

  it("CPF → código → senha nova → pede pra entrar de novo", async () => {
    invoke
      .mockResolvedValueOnce({ data: { ok: true, desafio: "d-1" }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, token: TOKEN }, error: null })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    tela();

    digitar(/CPF da conta/, "529.982.247-25");
    fireEvent.click(screen.getByText("Enviar código"));
    await screen.findByLabelText("Código");
    expect(invoke).toHaveBeenLastCalledWith("recuperar-senha", { body: { acao: "pedir", cpf: "52998224725" } });

    digitar("Código", "12a3456");
    fireEvent.click(screen.getByText("Continuar"));
    await screen.findByLabelText(/Nova senha/);
    expect(invoke).toHaveBeenLastCalledWith("recuperar-senha", { body: { acao: "verificar", desafio: "d-1", codigo: "123456" } });

    digitar(/Nova senha/, "senhaNova1");
    digitar("Confirme a senha", "senhaNova1");
    fireEvent.click(screen.getByText("Salvar nova senha"));
    await screen.findByText("Senha trocada!");
    expect(invoke).toHaveBeenLastCalledWith("recuperar-senha", {
      body: { acao: "trocar", token: TOKEN, senha: "senhaNova1", confirmacao: "senhaNova1" },
    });
  });

  it("código errado fica no passo do código", async () => {
    invoke
      .mockResolvedValueOnce({ data: { ok: true, desafio: "d-1" }, error: null })
      .mockResolvedValueOnce({ data: { ok: false, erro: "codigo" }, error: null });
    tela();
    digitar(/CPF da conta/, "52998224725");
    fireEvent.click(screen.getByText("Enviar código"));
    digitar(await screen.findByLabelText("Código") && "Código", "000000");
    fireEvent.click(screen.getByText("Continuar"));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Código")).toBeTruthy();
    expect(screen.queryByLabelText(/Nova senha/)).toBeNull();
  });

  it("senha curta não chega no servidor", async () => {
    invoke
      .mockResolvedValueOnce({ data: { ok: true, desafio: "d-1" }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, token: TOKEN }, error: null });
    tela();
    digitar(/CPF da conta/, "52998224725");
    fireEvent.click(screen.getByText("Enviar código"));
    digitar(await screen.findByLabelText("Código") && "Código", "123456");
    fireEvent.click(screen.getByText("Continuar"));
    await screen.findByLabelText(/Nova senha/);
    digitar(/Nova senha/, "1234567");
    digitar("Confirme a senha", "1234567");
    fireEvent.submit(screen.getByText("Salvar nova senha").closest("form")!);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("CPF inválido não chama o servidor", () => {
    tela();
    digitar(/CPF da conta/, "11111111111");
    fireEvent.click(screen.getByText("Enviar código"));
    expect(invoke).not.toHaveBeenCalled();
  });
});
