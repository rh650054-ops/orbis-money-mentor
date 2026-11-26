import { describe, expect, it } from "vitest";
import { classificar } from "./regras";

const agora = new Date("2026-11-26T12:00:00Z");
const depois = agora.getTime() + 10 * 86_400_000;
const nossa = { subscription_id: "S1", status_hotmart: "PAST_DUE", oferta_codigo: "8qbxvm9p", plano: "VANT", email: "ze@exemplo.com" };

describe("hotmart-simular: labels (26/11)", () => {
  it("each Hotmart answer → what the reconciliation would do", () => {
    expect(classificar(nossa, { status: "ACTIVE", date_next_charge: depois, email: "ze@exemplo.com" }, agora)).toBe("liberaria_pago_confirmado");
    expect(classificar(nossa, { status: "ACTIVE", date_next_charge: depois, email: "x@exemplo.com" }, agora)).toBe("pago_mas_titular_nao_confere");
    expect(classificar(nossa, { status: "DELAYED", date_next_charge: depois, email: "ze@exemplo.com" }, agora)).toBe("continua_atrasada");
    expect(classificar(nossa, { status: "STARTED", date_next_charge: null }, agora)).toBe("primeiro_pagamento_ainda_aberto");
    expect(classificar(nossa, { status: "CANCELLED_BY_CUSTOMER", date_next_charge: null }, agora)).toBe("encerrada_pode_assinar_de_novo");
    expect(classificar(nossa, { status: "INACTIVE", date_next_charge: null }, agora)).toBe("encerrada_pode_assinar_de_novo");
  });
});
