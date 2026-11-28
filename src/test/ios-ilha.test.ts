import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* 28/11/2026 (Rick, iPhone): lock screen R$ 120,00, Dynamic Island R$ 0,00, same session.
   One Live Activity, two fields: the lock screen draws the DAY, the island the current BLOCK. After a
   VANT Quick tap the iPhone copied the server's panel into the Live Activity, but only the day: the
   block kept the value the app wrote when the block started. These checks keep the two in step. */
const ler = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
const atividade = ler("ios/App/VantQuick/DefconAtividade.swift");
const intents = ler("ios/App/VantQuickCompartilhado/QuickIntents.swift");
const servidor = ler("ios/App/VantQuickCompartilhado/QuickServidor.swift");
const plugin = ler("ios/App/App/VantQuickPlugin.swift");
const migracao = ler("supabase/migrations/20261128190000_vant_quick_painel_bloco.sql");
const corpoAplicar = intents.slice(intents.indexOf("static func aplicar("), intents.indexOf("await atividade.update("));

describe("Dynamic Island and lock screen show the same session", () => {
  it("the island draws the block, the lock screen the day (layout unchanged)", () => {
    const ilha = atividade.slice(atividade.indexOf("dynamicIsland:"), atividade.indexOf(".keylineTint"));
    expect(ilha).toMatch(/ctx\.state\.faturamentoBloco/);
    expect(ilha).toMatch(/ctx\.state\.vendasBloco/);
    expect(ilha).not.toMatch(/faturamentoDia/);
    const tela = atividade.slice(atividade.indexOf("struct TelaBloqueada"));
    expect(tela).toMatch(/s\.faturamentoDia/);
  });

  it("the server's panel carries the block under the same names the iPhone decodes", () => {
    for (const k of ["faturamentoBloco", "metaHora", "vendasBloco"]) {
      expect(migracao).toMatch(new RegExp(`'${k}'`));
      expect(servidor).toMatch(new RegExp(`var ${k}: (Double|Int)\\?`));
    }
    // from the DEFCON's own columns, as the app reads them
    expect(migracao).toMatch(/'faturamentoBloco', coalesce\(round\(b\.achieved_amount, 2\), 0\)/);
    expect(migracao).toMatch(/'metaHora', coalesce\(round\(b\.target_amount, 2\), 0\)/);
    expect(migracao).toMatch(/cb\.sales_count[\s\S]*cb\.block_index = s\.current_block_index/);
  });

  it("after a tap, the Live Activity gets the server's block, not only the day (the R$ 0 bug)", () => {
    expect(corpoAplicar).toMatch(/e\.faturamentoDia = p\.faturamento/);
    expect(corpoAplicar).toMatch(/if let v = p\.faturamentoBloco \{ e\.faturamentoBloco = v \}/);
    expect(corpoAplicar).toMatch(/if let v = p\.metaHora \{ e\.metaHora = v \}/);
    expect(corpoAplicar).toMatch(/if let v = p\.vendasBloco \{ e\.vendasBloco = v \}/);
  });

  it("the cached copy never overwrites the app's fresh block; fresh panels do update it", () => {
    expect(corpoAplicar).toMatch(/if blocoDoServidor \{/);
    expect(intents).toMatch(/blocoDoServidor: Bool = true/);
    // the app lays its cached server copy over its own numbers: block left to the app
    expect(plugin).toMatch(/aplicar\(conta: conta, painel: ps\.painel, aviso: nil, avisoOk: false, blocoDoServidor: false\)/);
    // a pull from the server and a tap's answer are fresh: they keep the default (true)
    expect(plugin).toMatch(/aplicar\(conta: conta, painel: p, aviso: nil, avisoOk: false\)/);
    expect(intents).toMatch(/aplicar\(conta: conta, painel: painel, aviso: texto, avisoOk: ok\)/);
  });

  it("there is one DEFCON Live Activity at a time (no second one with other numbers)", () => {
    expect(plugin).toMatch(/for outra in atuais where outra\.id != daConta\.id \{ await outra\.end/);
    expect(plugin).toMatch(/for outra in atuais \{ await outra\.end\(nil, dismissalPolicy: \.immediate\) \}\s*_ = try\? Activity\.request/);
  });
});
