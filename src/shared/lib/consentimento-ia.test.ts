import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTO_IA_DESLIGADA, bloqueioIa, definirConsentimentoIa, nomeDaFuncao } from "./consentimento-ia";

const URL_BASE = "https://x.supabase.co/functions/v1/";

describe("gate de IA de terceiros (App Store 5.1.2(i))", () => {
  afterEach(() => definirConsentimentoIa(false));

  it("lê o nome da função da URL", () => {
    expect(nomeDaFuncao(`${URL_BASE}nota-ler?a=1`)).toBe("nota-ler");
    expect(nomeDaFuncao("https://x.supabase.co/rest/v1/profiles")).toBeNull();
  });

  it("sem permissão, bloqueia a chamada de IA aqui mesmo e avisa a tela", async () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_IA_DESLIGADA, ouvinte);
    const r = bloqueioIa(`${URL_BASE}nota-ler`);
    expect(r?.status).toBe(403);
    expect(await r?.json()).toEqual({ error: "ia_sem_consentimento" });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_IA_DESLIGADA, ouvinte);
  });

  it("função automática (fim do DEFCON) é bloqueada em silêncio", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_IA_DESLIGADA, ouvinte);
    expect(bloqueioIa(`${URL_BASE}generate-insights`)?.status).toBe(403);
    expect(ouvinte).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_IA_DESLIGADA, ouvinte);
  });

  it("com permissão passa, e funções sem IA nunca são bloqueadas", () => {
    expect(bloqueioIa(`${URL_BASE}delete-my-account`)).toBeNull();
    expect(bloqueioIa("https://x.supabase.co/rest/v1/sales")).toBeNull();
    definirConsentimentoIa(true);
    expect(bloqueioIa(`${URL_BASE}bright-action`)).toBeNull();
  });
});
