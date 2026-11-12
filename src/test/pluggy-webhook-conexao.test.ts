// A7 — what the webhook does with an event, given the connection it found for the Item.
import { describe, expect, it } from "vitest";
import { tratoDoEvento } from "../../supabase/functions/pluggy-webhook/conexao";
import { conferirEstado, STATUS_CONHECIDOS } from "../../supabase/functions/_shared/pluggy-estado";

describe("tratoDoEvento — a removed connection never comes back on its own", () => {
  it("an event for a removed connection: nothing is written, granted or imported", () => {
    expect(tratoDoEvento({ consultou: true, con: { status: "deleted" } })).toBe("removida");
    expect(tratoDoEvento({ consultou: true, con: { status: "DELETED" } })).toBe("removida");
  });
  it("every other stored state keeps being handled as before", () => {
    for (const status of STATUS_CONHECIDOS.filter((s) => s !== "deleted")) {
      expect(tratoDoEvento({ consultou: true, con: { status } })).toBe("seguir");
    }
    // unknown or empty states are live connections too: only "deleted" is removed
    for (const status of ["connected", "ALGO_NOVO", "", null, undefined]) {
      expect(tratoDoEvento({ consultou: true, con: { status } })).toBe("seguir");
    }
  });
  it("no connection for the Item: the auto-cura decides (as before)", () => {
    expect(tratoDoEvento({ consultou: true, con: null })).toBe("criar");
    expect(tratoDoEvento({ consultou: true, con: undefined })).toBe("criar");
  });
  it("the lookup failed: it is NOT 'no connection' — the event is left alone, whatever came back", () => {
    expect(tratoDoEvento({ consultou: false, con: null })).toBe("nao_consultada");
    expect(tratoDoEvento({ consultou: false, con: undefined })).toBe("nao_consultada");
    expect(tratoDoEvento({ consultou: false, con: { status: "UPDATED" } })).toBe("nao_consultada");
  });
  it("the webhook and the robot agree: what the robot never brings back, the webhook does not touch", () => {
    const item = { status: "UPDATED", executionStatus: "SUCCESS" };
    expect(conferirEstado("deleted", item).gravar).toBeNull(); // the robot (A5)
    expect(tratoDoEvento({ consultou: true, con: { status: "deleted" } })).toBe("removida"); // the webhook (A7)
  });
});
