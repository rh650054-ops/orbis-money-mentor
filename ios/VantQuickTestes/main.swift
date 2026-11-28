// Behavioural tests of the Live Activity / widget ordering rules (review of 28/11/2026).
// Plain Swift, run on the macOS CI runner (ios-compila.yml), outside the Xcode project:
//   swiftc QuickServidor.swift QuickArmazem.swift QuickCofre.swift main.swift && ./a.out
// They run the SAME QuickOrdem code the app and the widget extension use, with panels decoded
// from JSON exactly as the server sends them.
import Foundation

var falhas = 0, total = 0
func checar(_ nome: String, _ ok: Bool) {
    total += 1
    if ok { print("ok      \(nome)") } else { falhas += 1; print("FALHOU  \(nome)") }
}

let t0 = Date(timeIntervalSince1970: 1_795_800_000)
func hora(_ s: Double) -> String {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.string(from: t0.addingTimeInterval(s))
}
/// A panel as the server sends it.
func painel(sessao: String? = "S1", gerado: Double, bloco: Int = 1, dia: Double, fatBloco: Double, vendasBloco: Int = 0,
            vendas: Int = 0, inicio: Double = 0, estado: String = "running") -> QuickServidor.Painel {
    var o: [String: Any] = ["opcoes": [], "geradoEm": gerado]
    if let sessao {
        o.merge(["sessao": sessao, "data": "2026-11-28", "faturamento": dia, "meta": 270, "vendas": vendas, "abordagens": vendas * 2,
                 "bloco": bloco, "totalBlocos": 8, "blocoEstado": estado, "blocoInicio": hora(inicio), "blocoFim": hora(inicio + 3600),
                 "faturamentoBloco": fatBloco, "metaHora": 33.75, "vendasBloco": vendasBloco]) { $1 }
    }
    let dados = try! JSONSerialization.data(withJSONObject: o)
    return try! JSONDecoder().decode(QuickServidor.Painel.self, from: dados)
}
/// What the app writes (its own copy of the DEFCON).
func doApp(sessao: String? = "S1", bloco: Int = 1, dia: Double, fatBloco: Double, inicio: Double = 0, pausado: Bool = false) -> QuickVista {
    QuickVista(sessao: sessao, versao: nil, bloco: bloco, totalBlocos: 8, blocoInicio: t0.addingTimeInterval(inicio),
               blocoFim: t0.addingTimeInterval(inicio + 3600), pausado: pausado, faturamentoBloco: fatBloco, metaHora: 33.75,
               vendasBloco: 0, faturamentoDia: dia, metaDia: 270, vendasDia: 0, abordagensDia: 0, rapidaValor: nil)
}
func servidor(_ v: QuickVista, _ p: QuickServidor.Painel) -> QuickVista { QuickOrdem.comServidor(v, p) ?? v }

// 0. the 28/11 bug: after a tap, the island (block) and the lock screen (day) agree
var v = doApp(dia: 0, fatBloco: 0)
v = servidor(v, painel(gerado: 1000, dia: 120, fatBloco: 120, vendasBloco: 6, vendas: 6))
checar("0  tap answer: island R$ 120 (block) = lock screen R$ 120 (day), 6 sales in the block",
       v.faturamentoBloco == 120 && v.faturamentoDia == 120 && v.vendasBloco == 6)

// 1. answers out of order
v = doApp(dia: 0, fatBloco: 0)
v = servidor(v, painel(gerado: 2000, dia: 160, fatBloco: 160))     // the 2nd tap's answer arrives first
v = servidor(v, painel(gerado: 1000, dia: 140, fatBloco: 140))     // the 1st tap's answer arrives late
checar("1  out of order: the late older answer (R$ 140) never replaces the newer one (R$ 160)",
       v.faturamentoDia == 160 && v.faturamentoBloco == 160 && v.versao == 2000)

// 2. legitimate reversal: a NEWER answer with less money is drawn
v = servidor(v, painel(gerado: 3000, dia: 140, fatBloco: 140))
checar("2  sale reversed: the newer answer with R$ 20 less is drawn (newer wins, not higher)",
       v.faturamentoDia == 140 && v.faturamentoBloco == 140)

// 3. confirmed sale, then an outdated write of the app
v = doApp(dia: 100, fatBloco: 100)
v = servidor(v, painel(gerado: 1000, dia: 120, fatBloco: 120, vendasBloco: 6))
v = QuickOrdem.comApp(v, doApp(dia: 100, fatBloco: 100), interativo: true)   // the app had not seen the tap yet
checar("3  app writes its older copy after a confirmed tap: R$ 120 stays (day and block)",
       v.faturamentoDia == 120 && v.faturamentoBloco == 120 && v.vendasBloco == 6 && v.versao == 1000)

// 4. block change with an old cached answer
v = doApp(dia: 120, fatBloco: 120, inicio: 0)
v = servidor(v, painel(gerado: 1000, bloco: 1, dia: 120, fatBloco: 120))
v = QuickOrdem.comApp(v, doApp(bloco: 2, dia: 120, fatBloco: 0, inicio: 3600), interativo: true)   // app starts block 2
checar("4a block 2 started in the app: block 2's money (R$ 0) with block 2's countdown",
       v.bloco == 2 && v.faturamentoBloco == 0 && v.blocoInicio == t0.addingTimeInterval(3600) && v.faturamentoDia == 120)
v = servidor(v, painel(gerado: 900, bloco: 1, dia: 120, fatBloco: 120, inicio: 0))   // an old block-1 answer arrives
checar("4b an older answer of block 1 is dropped: never block 1's money/time over block 2",
       v.bloco == 2 && v.faturamentoBloco == 0 && v.blocoInicio == t0.addingTimeInterval(3600))
v = servidor(v, painel(gerado: 1100, bloco: 1, dia: 120, fatBloco: 120, inicio: 0))  // even a newer read that still says block 1
checar("4c a block-1 answer is dropped once block 2 is shown, even if stamped later",
       v.bloco == 2 && v.faturamentoBloco == 0)
v = servidor(v, painel(gerado: 1200, bloco: 2, dia: 140, fatBloco: 20, vendasBloco: 1, inicio: 3600))
checar("4d the first block-2 answer is drawn whole: R$ 20 in the block, R$ 140 the day, block-2 time",
       v.bloco == 2 && v.faturamentoBloco == 20 && v.faturamentoDia == 140 && v.blocoInicio == t0.addingTimeInterval(3600))
// the same block number: money and timing never come from two different blocks
v = QuickOrdem.comApp(v, doApp(bloco: 2, dia: 140, fatBloco: 20, inicio: 3600), interativo: true)
checar("4e every state drawn has money and countdown of the same block", v.bloco == 2 && v.blocoInicio == t0.addingTimeInterval(3600))

// 5. pause and resume
v = doApp(dia: 120, fatBloco: 120)
v = servidor(v, painel(gerado: 1000, dia: 120, fatBloco: 120))
v = QuickOrdem.comApp(v, doApp(dia: 120, fatBloco: 120, pausado: true), interativo: true)
checar("5a pause in the app (even offline) shows at once, the server's money stays", v.pausado && v.faturamentoDia == 120)
v = servidor(v, painel(gerado: 1100, dia: 120, fatBloco: 120, estado: "paused"))
checar("5b the server's answer agrees (paused)", v.pausado)
v = QuickOrdem.comApp(v, doApp(dia: 120, fatBloco: 120, inicio: 600, pausado: false), interativo: true)
checar("5c resume: running again with the resumed countdown", !v.pausado && v.blocoInicio == t0.addingTimeInterval(600))
v = servidor(v, painel(gerado: 1050, dia: 120, fatBloco: 120, estado: "paused"))
checar("5d a late 'paused' answer from before the resume is dropped", !v.pausado)

// 6. session ended and a new one started (restart, new day)
v = doApp(sessao: "S1", dia: 120, fatBloco: 120)
v = servidor(v, painel(sessao: "S1", gerado: 1000, dia: 120, fatBloco: 120))
v = QuickOrdem.comApp(v, doApp(sessao: "S2", dia: 0, fatBloco: 0), interativo: true)   // the app starts session S2
checar("6a new session: the app's S2 numbers (R$ 0), not S1's", v.sessao == "S2" && v.faturamentoDia == 0 && v.versao == nil)
v = servidor(v, painel(sessao: "S1", gerado: 5000, dia: 120, fatBloco: 120))
checar("6b a late answer of the old session S1 never updates S2 (even stamped later)", v.sessao == "S2" && v.faturamentoDia == 0)
v = servidor(v, painel(sessao: "S2", gerado: 5100, dia: 20, fatBloco: 20))
checar("6c S2's own answers are drawn", v.sessao == "S2" && v.faturamentoDia == 20)
checar("6d a panel with no DEFCON today changes nothing on the activity",
       QuickOrdem.comServidor(v, painel(sessao: nil, gerado: 9000, dia: 0, fatBloco: 0)) == nil)

// 7. not interactive: the app's copy, exactly as before the review (other accounts unchanged)
let antes = servidor(doApp(dia: 0, fatBloco: 0), painel(gerado: 1000, dia: 120, fatBloco: 120))
let app = doApp(dia: 50, fatBloco: 50)
checar("7  not interactive: the app's write is drawn as is", QuickOrdem.comApp(antes, app, interativo: false) == app)

// 8. the widgets' cached panel (App Group)
let c1 = QuickArmazem.PainelDoServidor(conta: "A", quando: 0, painel: painel(gerado: 2000, dia: 160, fatBloco: 160))
checar("8a cache: an older answer of the same account does not replace a newer one",
       !QuickOrdem.substituiCache(painel(gerado: 1000, dia: 140, fatBloco: 140), conta: "A", atual: c1))
checar("8b cache: a newer answer with less money (reversal) replaces it",
       QuickOrdem.substituiCache(painel(gerado: 3000, dia: 140, fatBloco: 140), conta: "A", atual: c1))
checar("8c account switch: another account's cached panel is always replaced",
       QuickOrdem.substituiCache(painel(gerado: 1, dia: 0, fatBloco: 0), conta: "B", atual: c1))
checar("8d cache: a newer answer of a new session (restart / new day) replaces the old one",
       QuickOrdem.substituiCache(painel(sessao: "S2", gerado: 2500, dia: 0, fatBloco: 0), conta: "A", atual: c1))
checar("8e server answers without a stamp (old server) are still accepted (compatibility)",
       QuickOrdem.substituiCache(painel(gerado: 0, dia: 1, fatBloco: 1), conta: "A",
                                 atual: .init(conta: "A", quando: 0, painel: { var p = painel(gerado: 0, dia: 1, fatBloco: 1); p.geradoEm = nil; return p }())))

// 9. block change while the app's own copy is behind (review 28/11, 2nd round)
v = doApp(dia: 100, fatBloco: 100)
v = servidor(v, painel(gerado: 1000, bloco: 1, dia: 120, fatBloco: 120, vendasBloco: 6))   // a tap the app has not seen
v = QuickOrdem.comApp(v, doApp(bloco: 2, dia: 100, fatBloco: 0, inicio: 3600), interativo: true)
checar("9a app starts block 2 with a stale day (R$ 100): the day stays the server's R$ 120",
       v.bloco == 2 && v.faturamentoDia == 120 && v.faturamentoBloco == 0 && v.blocoInicio == t0.addingTimeInterval(3600))
v = servidor(v, painel(gerado: 1100, bloco: 2, dia: 120, fatBloco: 0))
checar("9b the pull after it confirms block 2 at R$ 0 and the day at R$ 120", v.bloco == 2 && v.faturamentoDia == 120)
v = servidor(v, painel(gerado: 1200, bloco: 2, dia: 100, fatBloco: 0))
checar("9c a later reversal of R$ 20 is drawn (reductions are never blocked)", v.faturamentoDia == 100)

// 10. ties and microseconds
v = servidor(doApp(dia: 0, fatBloco: 0), painel(gerado: 1000.250, dia: 40, fatBloco: 40))
checar("10a microseconds order two answers of the same millisecond (1000.249 is older)",
       QuickOrdem.comServidor(v, painel(gerado: 1000.249, dia: 20, fatBloco: 20)) == nil)
checar("10b an exact tie is accepted (never treated as older): the later arrival is drawn",
       QuickOrdem.comServidor(v, painel(gerado: 1000.250, dia: 60, fatBloco: 60))?.faturamentoDia == 60)

// 11. Live Activity updates run one at a time (QuickFila)
final class Caixa: @unchecked Sendable { var valor = 0; var dentro = 0; var maxDentro = 0; let trava = NSLock() }
let caixa = Caixa()
await withTaskGroup(of: Void.self) { g in
    for _ in 0..<40 {
        g.addTask {
            await QuickFila.atividade.rodar {
                caixa.trava.lock(); caixa.dentro += 1; caixa.maxDentro = max(caixa.maxDentro, caixa.dentro); let lido = caixa.valor; caixa.trava.unlock()
                try? await Task.sleep(nanoseconds: UInt64.random(in: 100_000...2_000_000))   // an await, like activity.update
                caixa.trava.lock(); caixa.valor = lido + 1; caixa.dentro -= 1; caixa.trava.unlock()
            }
        }
    }
}
checar("11 40 concurrent read-modify-writes: none lost (40) and never two at once", caixa.valor == 40 && caixa.maxDentro == 1)

// 12. batched pulls (QuickAgrupador)
final class Contador: @unchecked Sendable { var n = 0; var inicios: [Date] = []; let trava = NSLock() }
let cont = Contador()
let agrupador = QuickAgrupador(intervaloMs: 50) {
    cont.trava.lock(); cont.n += 1; cont.inicios.append(Date()); cont.trava.unlock()
    try? await Task.sleep(nanoseconds: 30_000_000)
}
var ultimoPedido = Date()
await withTaskGroup(of: Void.self) { g in
    for k in 0..<25 {
        g.addTask { try? await Task.sleep(nanoseconds: UInt64(k) * 2_000_000); await agrupador.pedir() }
    }
    ultimoPedido = Date().addingTimeInterval(0.048)
}
try? await Task.sleep(nanoseconds: 300_000_000)
checar("12a 25 requests in 50 ms become at most 3 pulls (\(cont.n))", cont.n >= 1 && cont.n <= 3)
checar("12b a pull started after the last request (no change is left without a fresh read)",
       (cont.inicios.last ?? .distantPast) >= ultimoPedido.addingTimeInterval(-0.05))

// 13. the widgets' cache under concurrent writers (files per answer, no lock)
let pastaTeste = FileManager.default.temporaryDirectory.appendingPathComponent("vant-quick-teste-\(UUID().uuidString)", isDirectory: true)
QuickArmazem.pastaDeTeste = pastaTeste
QuickArmazem.conta = "A"
let carimbos = (1...300).map { _ in Double(Int.random(in: 1_000_000...9_999_999)) / 1000 }
DispatchQueue.concurrentPerform(iterations: carimbos.count) { k in
    _ = QuickArmazem.guardarPainelServidor(conta: "A", painel(gerado: carimbos[k], dia: carimbos[k], fatBloco: 0))
}
checar("13a 300 answers written by 8+ threads at once: the newest one is the one read",
       QuickArmazem.painelServidor?.painel.geradoEm == carimbos.max())
_ = QuickArmazem.guardarPainelServidor(conta: "A", painel(gerado: 1, dia: 1, fatBloco: 0))
checar("13b an older answer written afterwards does not replace it", QuickArmazem.painelServidor?.painel.geradoEm == carimbos.max())
QuickArmazem.conta = "B"
checar("13c account switch: B never reads A's cached panel", QuickArmazem.painelServidor == nil)
checar("13d a late answer of A after the switch is not stored", !QuickArmazem.guardarPainelServidor(conta: "A", painel(gerado: 99_999, dia: 1, fatBloco: 0)))
_ = QuickArmazem.guardarPainelServidor(conta: "B", painel(gerado: 5, dia: 7, fatBloco: 0))
checar("13e B's own answer is read, even with an older stamp than A's (A's files are not B's)", QuickArmazem.painelServidor?.painel.faturamento == 7)
checar("13g A's answers are no longer on the phone once B stores its own", (try? FileManager.default.contentsOfDirectory(atPath: pastaTeste.appendingPathComponent("paineis-servidor").path))?.allSatisfy { $0.contains("_B_") } == true)
QuickArmazem.limpar()
checar("13f sign-out wipes every cached answer", QuickArmazem.painelServidor == nil)
try? FileManager.default.removeItem(at: pastaTeste)

print("\n\(total - falhas)/\(total) ok")
exit(falhas == 0 ? 0 : 1)
