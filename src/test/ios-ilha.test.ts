import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* 28/11/2026 (Rick, iPhone): lock screen R$ 120,00, Dynamic Island R$ 0,00, same session.
   The BEHAVIOUR (out-of-order answers, block change, new session, pause, reversal) is tested in
   plain Swift on the macOS runner: ios/VantQuickTestes/main.swift, run by ios-compila.yml.
   These checks only keep the WIRING in place, which a source scan can see and the Swift tests
   cannot: which code calls the tested rules, and that the names agree on both sides. */
const ler = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
const atividade = ler("ios/App/VantQuick/DefconAtividade.swift");
const intents = ler("ios/App/VantQuickCompartilhado/QuickIntents.swift");
const servidor = ler("ios/App/VantQuickCompartilhado/QuickServidor.swift");
const plugin = ler("ios/App/App/VantQuickPlugin.swift");
const migracao = ler("supabase/migrations/20261128190000_vant_quick_painel_bloco.sql");
const ci = ler(".github/workflows/ios-compila.yml");

describe("Dynamic Island / lock screen wiring", () => {
  it("the island draws the block, the lock screen the day (layout unchanged)", () => {
    const ilha = atividade.slice(atividade.indexOf("dynamicIsland:"), atividade.indexOf(".keylineTint"));
    expect(ilha).toMatch(/ctx\.state\.faturamentoBloco/);
    expect(ilha).not.toMatch(/faturamentoDia/);
    expect(atividade.slice(atividade.indexOf("struct TelaBloqueada"))).toMatch(/s\.faturamentoDia/);
  });

  it("the server's panel and the iPhone use the same names (block + ordering stamp)", () => {
    for (const k of ["faturamentoBloco", "metaHora", "vendasBloco", "geradoEm"]) {
      expect(migracao).toMatch(new RegExp(`'${k}'`));
      expect(servidor).toMatch(new RegExp(`var ${k}: (Double|Int)\\?`));
    }
  });

  it("every server answer reaches the Live Activity through QuickOrdem.comServidor", () => {
    const aplicar = intents.slice(intents.indexOf("static func aplicar("), intents.indexOf("await atividade.update("));
    expect(aplicar).toMatch(/QuickOrdem\.comServidor\(e\.vista, p\)/);
    expect(aplicar).not.toMatch(/e\.faturamento\w* = p\./); // no field copied around the rules
  });

  it("the app's own write goes through QuickOrdem.comApp, and never lays the cached copy over it", () => {
    expect(plugin).toMatch(/QuickOrdem\.comApp\(atual\.vista, estado\.vista, interativo: true\)/);
    expect(plugin).not.toMatch(/painel: ps\.painel/);
    expect(plugin).toMatch(/sessao: d\["sessao"\] as\? String/);
  });

  it("every write of the widgets' cached panel goes through the ordering guard", () => {
    for (const f of ["ios/App/VantQuickCompartilhado/QuickIntents.swift", "ios/App/App/VantQuickPlugin.swift",
                     "ios/App/VantQuick/PainelWidget.swift", "ios/App/VantQuick/VendaRapidaWidget.swift"]) {
      expect(ler(f)).not.toMatch(/painelServidor = \.init\(/);
    }
  });

  it("the CI check compiles and runs the Swift behaviour tests from the app's own files", () => {
    expect(ci).toMatch(/ios\/App\/VantQuickCompartilhado\/QuickServidor\.swift/);
    expect(ci).toMatch(/ios\/VantQuickTestes\/main\.swift/);
  });
});
