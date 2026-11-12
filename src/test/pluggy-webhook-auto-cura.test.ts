// The webhook's auto-cura (it creates the connection on its own when Pluggy reports an Item we do
// not have). Direct consumer of the slot check: only a limit that is KNOWN and exceeded may delete
// the Item on Pluggy; a check that failed creates nothing and deletes nothing.
import { describe, expect, it } from "vitest";
import { autoCura, type Curada, type ItemDaCura, type LinhaDaCura, type PortasDaCura } from "../../supabase/functions/pluggy-webhook/auto-cura";
import { decidirVaga, type Ativa } from "../../supabase/functions/_shared/pluggy-vaga";

const ANA = "ana-uid";

function cena(o: { pro?: boolean; ativas?: Ativa[] | null; limite?: number | null | undefined; naoGrava?: boolean; umPorBancoFalha?: boolean } = {}) {
  const feito = { vagas: 0, apagados: [] as string[], gravadas: [] as LinhaDaCura[], umPorBanco: 0, registros: [] as string[] };
  const portas: PortasDaCura = {
    ehPro: async () => o.pro ?? true,
    vaga: async (_dono, banco, itemId) => {
      feito.vagas++;
      return decidirVaga({ ativas: o.ativas === undefined ? [] : o.ativas, limite: "limite" in o ? o.limite : 1, banco, itemId });
    },
    apagarNaPluggy: async (itemId) => { feito.apagados.push(itemId); },
    gravar: async (linha) => {
      feito.gravadas.push(linha);
      return o.naoGrava ? null : ({ id: "con-nova", user_id: linha.user_id, institution_name: linha.institution_name } satisfies Curada);
    },
    umPorBanco: async () => { feito.umPorBanco++; if (o.umPorBancoFalha) throw new Error("pluggy fora"); },
    agora: () => new Date("2026-11-12T12:30:00Z"),
    registrar: (msg) => { feito.registros.push(msg); },
  };
  return { portas, feito };
}
const item = (banco: string, status: string | null = "UPDATED"): ItemDaCura => ({ status, connector: { name: banco, imageUrl: `https://logo/${banco}` } });
const nubank: Ativa[] = [{ id: "1", item_id: "it-nu", institution_name: "Nubank", created_at: "2026-10-01T00:00:00Z" }];

describe("pluggy-webhook auto-cura", () => {
  it("free slot: creates the connection for the Item's owner and applies 'one per bank'", async () => {
    const c = cena();
    const r = await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA });
    expect(r).toEqual({ con: { id: "con-nova", user_id: ANA, institution_name: "Nubank" } });
    expect(c.feito.gravadas).toEqual([{
      user_id: ANA, item_id: "it-1", institution_name: "Nubank", institution_logo: "https://logo/Nubank",
      status: "UPDATED", updated_at: "2026-11-12T12:30:00.000Z",
    }]);
    expect(c.feito.umPorBanco).toBe(1);
    expect(c.feito.apagados).toEqual([]);
  });
  it("an Item with no status is created as UPDATING (as before)", async () => {
    const c = cena();
    await autoCura(c.portas, { itemId: "it-1", item: item("Nubank", null), dono: ANA });
    expect(c.feito.gravadas[0]?.status).toBe("UPDATING");
  });
  it("limit known and exceeded: no connection, the Item is deleted on Pluggy (as before)", async () => {
    const c = cena({ ativas: nubank, limite: 1 });
    expect(await autoCura(c.portas, { itemId: "it-itau", item: item("Itaú"), dono: ANA })).toEqual({ recusa: "sem_vaga" });
    expect(c.feito.apagados).toEqual(["it-itau"]);
    expect(c.feito.gravadas).toEqual([]);
  });
  it("the limit cannot be read: no connection and the Item is NOT deleted", async () => {
    const c = cena({ ativas: nubank, limite: undefined });
    expect(await autoCura(c.portas, { itemId: "it-itau", item: item("Itaú"), dono: ANA })).toEqual({ recusa: "limite_indisponivel" });
    expect(c.feito.apagados).toEqual([]);
    expect(c.feito.gravadas).toEqual([]);
    expect(c.feito.umPorBanco).toBe(0);
    expect(c.feito.registros).toContain("pluggy-webhook: limite indisponivel, conexao nao criada e item mantido");
  });
  it("the seller's connections cannot be read: no connection and the Item is NOT deleted", async () => {
    const c = cena({ ativas: null, limite: 1 });
    expect(await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toEqual({ recusa: "limite_indisponivel" });
    expect(c.feito.apagados).toEqual([]);
    expect(c.feito.gravadas).toEqual([]);
  });
  it("a first bank is not let in on a failed check (it used to be)", async () => {
    const c = cena({ ativas: [], limite: undefined });
    expect(await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toEqual({ recusa: "limite_indisponivel" });
    expect(c.feito.gravadas).toEqual([]);
  });
  it("Pluggy's next event for the same Item creates it once the check answers again", async () => {
    const falhou = cena({ limite: undefined });
    expect(await autoCura(falhou.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toEqual({ recusa: "limite_indisponivel" });
    const voltou = cena({ limite: 1 });
    expect(await autoCura(voltou.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toHaveProperty("con");
  });
  it("owner without Pro: nothing is created, nothing deleted, the slot is not even asked", async () => {
    const c = cena({ pro: false });
    expect(await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toEqual({ recusa: "sem_pro" });
    expect(c.feito).toMatchObject({ vagas: 0, apagados: [], gravadas: [] });
  });
  it("no Item from Pluggy or no owner: nothing happens", async () => {
    for (const caso of [{ item: null, dono: ANA }, { item: item("Nubank"), dono: "" }]) {
      const c = cena();
      expect(await autoCura(c.portas, { itemId: "it-1", ...caso })).toEqual({ recusa: "sem_dono" });
      expect(c.feito).toMatchObject({ vagas: 0, apagados: [], gravadas: [] });
    }
  });
  it("the row was not saved: no connection is reported and 'one per bank' does not run", async () => {
    const c = cena({ naoGrava: true });
    expect(await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toEqual({ recusa: "nao_gravou" });
    expect(c.feito.umPorBanco).toBe(0);
    expect(c.feito.apagados).toEqual([]);
  });
  it("a failure in 'one per bank' does not undo the connection", async () => {
    const c = cena({ umPorBancoFalha: true });
    expect(await autoCura(c.portas, { itemId: "it-1", item: item("Nubank"), dono: ANA })).toHaveProperty("con");
  });
});
