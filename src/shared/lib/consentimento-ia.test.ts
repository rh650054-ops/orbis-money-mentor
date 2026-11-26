import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTO_IA_DESLIGADA, VERSAO_DIVULGACAO_IA, bloqueioIa, definirConsentimentoIa, estadoDoConsentimento, iaPermitidaPara, nomeDaFuncao } from "./consentimento-ia";

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
  // "Importar histórico" sent the vendor's file to an AI with no check at all until 26/11
  it("importar histórico é bloqueado sem permissão e avisa a tela", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_IA_DESLIGADA, ouvinte);
    expect(bloqueioIa(`${URL_BASE}import-financial-pdf`)?.status).toBe(403);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_IA_DESLIGADA, ouvinte);
  });
  it("função que só o texto atual cita: permissão num texto antigo que ainda vale não abre", () => {
    definirConsentimentoIa(true, false);
    expect(bloqueioIa(`${URL_BASE}bright-action`)).toBeNull();
    expect(bloqueioIa(`${URL_BASE}import-financial-pdf`)?.status).toBe(403);
    expect(iaPermitidaPara("import-financial-pdf")).toBe(false);
    definirConsentimentoIa(true, true);
    expect(bloqueioIa(`${URL_BASE}import-financial-pdf`)).toBeNull();
    definirConsentimentoIa(false, true); // a refusal never opens anything, whatever the text
    expect(iaPermitidaPara("import-financial-pdf")).toBe(false);
  });
  it("lê a resposta guardada: texto atual, texto antigo que ainda vale, e o resto conta como não respondido", () => {
    expect(estadoDoConsentimento(null)).toEqual({ resposta: null, textoAtual: false });
    expect(estadoDoConsentimento({ permitido: true, versao: VERSAO_DIVULGACAO_IA })).toEqual({ resposta: true, textoAtual: true });
    expect(estadoDoConsentimento({ permitido: false, versao: VERSAO_DIVULGACAO_IA })).toEqual({ resposta: false, textoAtual: true });
    expect(estadoDoConsentimento({ permitido: true, versao: "2026-11-27" })).toEqual({ resposta: true, textoAtual: false });
    expect(estadoDoConsentimento({ permitido: false, versao: "2026-11-27" })).toEqual({ resposta: false, textoAtual: false });
    for (const versao of ["2026-11-26", "2026-11-23", null, undefined]) {
      expect(estadoDoConsentimento({ permitido: true, versao })).toEqual({ resposta: null, textoAtual: false });
    }
  });
  it("clima e mensagem do DEFCON passam no app: o servidor responde sem IA quando não há permissão", () => {
    expect(bloqueioIa(`${URL_BASE}clima-vendedor`)).toBeNull();
    expect(bloqueioIa(`${URL_BASE}defcon-coach`)).toBeNull();
  });
});
