// A3 — connection, consent and reconnection states (supabase/functions/_shared/pluggy-estado.ts).
// One list for the app, the robot, the webhook and pluggy-item.
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  acaoDoVendedor, consentimentoDoItem, grupoDoStatus, precisaDoVendedor, resumoDoEstado, statusParaGravar,
  STATUS_CONHECIDOS, type Consentimento,
} from "../../supabase/functions/_shared/pluggy-estado";
import { precisaDoVendedor as doRobo } from "../../supabase/functions/_shared/pluggy-agenda";
import { saudeDoBanco } from "@/components/conectar/pluggy";
import { statusDoBanco } from "@/features/vender/lib/bancos";

const agora = new Date("2026-11-12T12:00:00Z");
const DO_VENDEDOR = ["WAITING_USER_INPUT", "WAITING_USER_ACTION", "USER_INPUT_TIMEOUT", "USER_AUTHORIZATION_PENDING",
  "USER_AUTHORIZATION_NOT_GRANTED", "USER_AUTHORIZATION_REVOKED", "INVALID_CREDENTIALS", "INVALID_CREDENTIALS_MFA", "LOGIN_ERROR"];
const DESCONHECIDOS = ["", "connected", "QUALQUER_COISA_NOVA", "ACCOUNT_NEEDS_ACTION", "SUCCESS", null, undefined];

describe("statusParaGravar — what is stored is always something Pluggy said", () => {
  it("12/11 09:00 in production: the seller never finished the authorisation", () => {
    expect(statusParaGravar({ status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT" })).toBe("USER_INPUT_TIMEOUT");
    // the reason only in the error object (as the item/error event carries it)
    expect(statusParaGravar({ status: "OUTDATED", error: { code: "USER_INPUT_TIMEOUT" } })).toBe("USER_INPUT_TIMEOUT");
  });
  it("every reason that depends on the seller replaces a general non-healthy status", () => {
    for (const motivo of DO_VENDEDOR.filter((m) => m !== "LOGIN_ERROR")) {
      for (const status of ["OUTDATED", "LOGIN_ERROR", "UPDATING", "WAITING_USER_INPUT"]) {
        expect(statusParaGravar({ status, executionStatus: motivo })).toBe(motivo);
      }
    }
  });
  it("UPDATED is never replaced, whatever the reason field says", () => {
    for (const motivo of ["SUCCESS", "PARTIAL_SUCCESS", "USER_INPUT_TIMEOUT", "INVALID_CREDENTIALS", ""]) {
      expect(statusParaGravar({ status: "UPDATED", executionStatus: motivo, error: { code: "USER_INPUT_TIMEOUT" } })).toBe("UPDATED");
    }
  });
  it("a bank that is down stays as Pluggy's own status: nothing for the seller to do", () => {
    for (const motivo of ["SITE_NOT_AVAILABLE", "ERROR", "CONNECTION_ERROR", "", null]) {
      expect(statusParaGravar({ status: "OUTDATED", executionStatus: motivo })).toBe("OUTDATED");
    }
    expect(statusParaGravar({ status: "UPDATING", executionStatus: "LOGIN_IN_PROGRESS" })).toBe("UPDATING");
  });
  it("the execution's reason wins over an error left from before", () => {
    expect(statusParaGravar({ status: "UPDATING", executionStatus: "LOGIN_IN_PROGRESS", error: { code: "USER_INPUT_TIMEOUT" } })).toBe("UPDATING");
  });
  it("a reason we do not know never changes what is stored, and an unknown status is kept as it came", () => {
    expect(statusParaGravar({ status: "OUTDATED", executionStatus: "ACCOUNT_NEEDS_ACTION" })).toBe("OUTDATED");
    expect(statusParaGravar({ status: "Algo_Novo", executionStatus: "X" })).toBe("Algo_Novo");
  });
  it("no status from Pluggy: nothing to store (the caller keeps what it had)", () => {
    for (const item of [null, undefined, {}, { status: null }, { status: "  " }, { executionStatus: "USER_INPUT_TIMEOUT" }]) {
      expect(statusParaGravar(item)).toBe("");
    }
  });
});

describe("grupoDoStatus — reading the stored status", () => {
  it("groups", () => {
    expect(grupoDoStatus("UPDATED")).toBe("em_dia");
    expect(grupoDoStatus("updating")).toBe("lendo");
    expect(grupoDoStatus("LOGIN_IN_PROGRESS")).toBe("lendo");
    for (const s of DO_VENDEDOR) expect(grupoDoStatus(s)).toBe("precisa_vendedor");
    for (const s of ["OUTDATED", "ERROR", "SITE_NOT_AVAILABLE", "CONNECTION_ERROR"]) expect(grupoDoStatus(s)).toBe("provedor_atrasado");
    expect(grupoDoStatus("deleted")).toBe("removido");
  });
  it("anything else is 'desconhecido' — including the column's old default", () => {
    for (const s of DESCONHECIDOS) expect(grupoDoStatus(s)).toBe("desconhecido");
  });
  it("every known value has a group", () => {
    for (const s of STATUS_CONHECIDOS) expect(grupoDoStatus(s)).not.toBe("desconhecido");
  });
});

describe("the robot and the app use the same list", () => {
  const todos = [...STATUS_CONHECIDOS, ...DESCONHECIDOS];
  it("pluggy-agenda's precisaDoVendedor is this file's", () => {
    for (const s of todos) expect(doRobo(s)).toBe(precisaDoVendedor(s));
    expect(doRobo("USER_INPUT_TIMEOUT")).toBe(true);
    expect(doRobo("WAITING_USER_ACTION")).toBe(true); // 17/10: 32 in a day while the robot kept asking
    expect(doRobo("USER_AUTHORIZATION_REVOKED")).toBe(true);
    expect(doRobo("OUTDATED")).toBe(false); // bank down: the robot keeps trying
    expect(doRobo("UPDATED")).toBe(false);
  });
  it("the app offers 'Autorizar' exactly where the robot stops pulling", () => {
    for (const s of todos) {
      const st = statusDoBanco(s ?? null, "2026-11-12T11:50:00Z", agora.getTime());
      expect(st.autorizar).toBe(precisaDoVendedor(s));
      if (st.autorizar) expect(st).toMatchObject({ rotulo: "DESCONECTADO", detalhe: "autorize de novo no app do banco" });
    }
  });
  it("the bank being down is still said as the bank's side, with no action", () => {
    expect(statusDoBanco("OUTDATED", "2026-11-12T11:50:00Z", agora.getTime()))
      .toEqual({ rotulo: "ATENÇÃO", tom: "atencao", detalhe: "o banco está fora — não é você", autorizar: false });
  });
  it("a state the app does not know is never shown as success (A13)", () => {
    for (const s of DESCONHECIDOS) {
      const saude = saudeDoBanco(s ?? null, "2026-11-12T11:50:00Z");
      expect(saude.texto).toBe("aguardando o banco");
      expect(saude.cor).not.toBe("#3DD68C");
      const st = statusDoBanco(s ?? null, "2026-11-12T11:50:00Z", agora.getTime());
      expect(st.rotulo).toBe("ATENÇÃO");
      expect(st.autorizar).toBe(false);
    }
  });
  it("what did not change: healthy and reading banks", () => {
    expect(statusDoBanco("UPDATED", "2026-11-12T11:50:00Z", agora.getTime()).rotulo).toBe("ATIVO");
    expect(statusDoBanco("UPDATING", "2026-11-12T11:50:00Z", agora.getTime())).toMatchObject({ rotulo: "ATIVO", detalhe: "lendo agora…" });
    expect(saudeDoBanco("UPDATED", null)).toMatchObject({ texto: "em dia", alerta: false });
    expect(saudeDoBanco("LOGIN_IN_PROGRESS", null)).toMatchObject({ texto: "atualizando…", alerta: false });
  });
});

describe("consentimentoDoItem — only what Pluggy says explicitly", () => {
  const c = (item: Parameters<typeof consentimentoDoItem>[0]) => consentimentoDoItem(item, agora);
  it("UPDATED proves nothing about the consent (A12)", () => {
    expect(c({ status: "UPDATED", executionStatus: "SUCCESS" })).toBe("nao_informado");
    expect(c({ status: "UPDATED", executionStatus: "PARTIAL_SUCCESS" })).toBe("nao_informado");
  });
  it("a bank that is down is not a consent state", () => {
    expect(c({ status: "OUTDATED", executionStatus: "SITE_NOT_AVAILABLE" })).toBe("nao_informado");
    expect(c({ status: "OUTDATED", executionStatus: "CONNECTION_ERROR" })).toBe("nao_informado");
  });
  it("reasons that depend on the seller", () => {
    const casos: [string, string, Consentimento][] = [
      ["OUTDATED", "USER_INPUT_TIMEOUT", "aguardando_vendedor"],
      ["WAITING_USER_INPUT", "WAITING_USER_INPUT", "aguardando_vendedor"],
      ["UPDATING", "WAITING_USER_ACTION", "aguardando_vendedor"],
      ["OUTDATED", "USER_AUTHORIZATION_PENDING", "aguardando_vendedor"],
      ["LOGIN_ERROR", "USER_AUTHORIZATION_NOT_GRANTED", "aguardando_vendedor"],
      ["LOGIN_ERROR", "USER_AUTHORIZATION_REVOKED", "revogado"],
      ["LOGIN_ERROR", "INVALID_CREDENTIALS", "credencial_invalida"],
      ["LOGIN_ERROR", "", "credencial_invalida"],
    ];
    for (const [status, executionStatus, esperado] of casos) expect(c({ status, executionStatus })).toBe(esperado);
  });
  it("the consent's validity, when Pluggy sends it", () => {
    expect(c({ status: "UPDATED", consentExpiresAt: "2027-06-01T00:00:00Z" })).toBe("autorizado");
    expect(c({ status: "UPDATED", consentExpiresAt: "2026-11-15T00:00:00Z" })).toBe("expirando");
    expect(c({ status: "UPDATED", consentExpiresAt: "2026-11-12T11:59:59Z" })).toBe("expirado");
    expect(c({ status: "OUTDATED", executionStatus: "SITE_NOT_AVAILABLE", consentExpiresAt: "2026-11-01T00:00:00Z" })).toBe("expirado");
    expect(c({ status: "UPDATED", consentExpiresAt: "amanhã" })).toBe("nao_informado"); // not a date: says nothing
    // a seller's pending action is more specific than the date
    expect(c({ status: "LOGIN_ERROR", executionStatus: "USER_AUTHORIZATION_REVOKED", consentExpiresAt: "2027-06-01T00:00:00Z" })).toBe("revogado");
  });
  it("what we do not recognise is 'desconhecido', never authorised", () => {
    expect(c({ status: "ALGO_NOVO" })).toBe("desconhecido");
    expect(c({ status: "" })).toBe("desconhecido");
    expect(c(null)).toBe("nao_informado"); // Pluggy did not answer: nothing was said
  });
  it("every state that depends on the seller is solved by reauthorising; the others ask nothing", () => {
    const pedem: Consentimento[] = ["aguardando_vendedor", "credencial_invalida", "expirado", "revogado"];
    const naoPedem: Consentimento[] = ["autorizado", "expirando", "nao_informado", "desconhecido"];
    for (const x of pedem) expect(acaoDoVendedor(x)).toBe("reautorizar");
    for (const x of naoPedem) expect(acaoDoVendedor(x)).toBe("nenhuma");
  });
});

describe("resumoDoEstado — the log line", () => {
  it("carries what Pluggy said and what we made of it, and nothing personal", () => {
    const item = { status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT", error: { code: "USER_INPUT_TIMEOUT", message: "User requested input had expired" },
      consentExpiresAt: null, clientUserId: "ana-uid", connector: { name: "Inter" }, id: "item-1" };
    const r = resumoDoEstado(item, agora);
    expect(r).toEqual({ status: "OUTDATED", exec: "USER_INPUT_TIMEOUT", erro: "USER_INPUT_TIMEOUT", expira: null,
      gravar: "USER_INPUT_TIMEOUT", consentimento: "aguardando_vendedor", acao: "reautorizar" });
    expect(JSON.stringify(r)).not.toMatch(/ana-uid|Inter|item-1/);
  });
  it("no Item: nothing said", () => {
    expect(resumoDoEstado(null, agora)).toMatchObject({ status: null, gravar: null, consentimento: "nao_informado", acao: "nenhuma" });
  });
});
