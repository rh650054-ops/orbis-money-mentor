import Capacitor
import Foundation
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// VANT Quick's bridge (iPhone): App Group storage for the widgets, widget reloads and the DEFCON
/// Live Activity. It only translates calls: what a tap may do is decided by the app
/// (src/features/vant-quick) through the DEFCON's own code. Registered by MainViewController.
@objc(VantQuickPlugin)
public class VantQuickPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VantQuickPlugin"
    public let jsName = "VantQuick"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "definirConta", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salvarConfig", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salvarPainel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendentes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "concluir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "atividade", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "limpar", returnType: CAPPluginReturnPromise)
    ]

    private var ultimoRecarregarPainel = Date.distantPast
    private var observador: NSObjectProtocol?

    override public func load() {
        // a widget tap made while the app is open (or that opened it): the web side is told at once;
        // retainUntilConsumed keeps it until the web side is listening (cold start)
        observador = NotificationCenter.default.addObserver(forName: QuickToque.aviso, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("acao", data: [:], retainUntilConsumed: true)
        }
    }

    deinit { if let observador { NotificationCenter.default.removeObserver(observador) } }

    @objc func definirConta(_ call: CAPPluginCall) {
        let nova = call.getString("conta")
        if QuickArmazem.conta != nova { QuickArmazem.conta = nova; WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }

    @objc func salvarConfig(_ call: CAPPluginCall) {
        if let valor = call.getDouble("valor"), valor > 0, let rotulo = call.getString("rotulo") {
            QuickArmazem.config = QuickArmazem.Config(valor: valor, rotulo: rotulo)
        } else {
            QuickArmazem.config = nil
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "VantVendaRapida")
        call.resolve()
    }

    @objc func salvarPainel(_ call: CAPPluginCall) {
        guard let bruto = call.getObject("painel"), let dados = try? JSONSerialization.data(withJSONObject: bruto),
              let painel = try? JSONDecoder().decode(QuickArmazem.Painel.self, from: dados),
              painel.conta == QuickArmazem.conta else { return call.resolve() }
        QuickArmazem.painel = painel
        // WidgetKit budget: the performance widget is reloaded at most every 30 s from here
        if Date().timeIntervalSince(ultimoRecarregarPainel) > 30 {
            ultimoRecarregarPainel = Date()
            WidgetCenter.shared.reloadTimelines(ofKind: "VantPainel")
        }
        call.resolve()
    }

    @objc func pendentes(_ call: CAPPluginCall) {
        let acoes: [[String: Any]] = QuickArmazem.pendentes.map {
            ["id": $0.id, "tipo": $0.tipo, "criadoEm": $0.criadoEm, "conta": $0.conta as Any? ?? NSNull()]
        }
        call.resolve(["acoes": acoes])
    }

    @objc func concluir(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let estado = call.getString("estado"),
              ["pendente_sync", "confirmada", "recusada"].contains(estado) else { return call.reject("dados") }
        let tipo = QuickArmazem.pendentes.first(where: { $0.id == id })?.tipo ?? QuickArmazem.ultima?.tipo ?? "venda"
        QuickArmazem.remover(id)
        // the status line follows the LAST tap only
        if QuickArmazem.ultima == nil || QuickArmazem.ultima?.id == id || estado == "recusada" {
            QuickArmazem.ultima = QuickArmazem.Ultima(id: id, tipo: tipo, estado: estado, texto: call.getString("texto"), quando: Date().timeIntervalSince1970 * 1000)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "VantVendaRapida")
        call.resolve()
    }

    @objc func atividade(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { return call.resolve() }
        if call.getString("acao") == "encerrar" {
            Task { await GerenteAtividade.encerrar(); call.resolve() }
            return
        }
        guard let d = call.getObject("dados"), let conta = d["conta"] as? String, conta == QuickArmazem.conta,
              let inicio = d["inicio"] as? Double, let fim = d["fim"] as? Double else { return call.resolve() }
        let estado = QuickAtributos.ContentState(
            blocoInicio: Date(timeIntervalSince1970: inicio / 1000), blocoFim: Date(timeIntervalSince1970: fim / 1000),
            bloco: d["bloco"] as? Int ?? 1, totalBlocos: d["totalBlocos"] as? Int ?? 1,
            faturamentoBloco: d["faturamentoBloco"] as? Double ?? 0, metaHora: d["metaHora"] as? Double ?? 0,
            vendasBloco: d["vendasBloco"] as? Int ?? 0, pausado: d["pausado"] as? Bool ?? false)
        Task { await GerenteAtividade.atualizar(conta: conta, estado: estado); call.resolve() }
        #else
        call.resolve()
        #endif
    }

    @objc func limpar(_ call: CAPPluginCall) {
        QuickArmazem.limpar()
        WidgetCenter.shared.reloadAllTimelines()
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) { Task { await GerenteAtividade.encerrar(); call.resolve() }; return }
        #endif
        call.resolve()
    }
}

#if canImport(ActivityKit)
/// One DEFCON Live Activity at a time, of the signed-in account.
@available(iOS 16.2, *)
enum GerenteAtividade {
    static func atualizar(conta: String, estado: QuickAtributos.ContentState) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // stale 15 min after the block's end: the lock screen shows it as old, never as live
        let conteudo = ActivityContent(state: estado, staleDate: estado.blocoFim.addingTimeInterval(15 * 60))
        let atuais = Activity<QuickAtributos>.activities
        if let daConta = atuais.first(where: { $0.attributes.conta == conta }) {
            await daConta.update(conteudo)
            for outra in atuais where outra.id != daConta.id { await outra.end(nil, dismissalPolicy: .immediate) }
            return
        }
        for outra in atuais { await outra.end(nil, dismissalPolicy: .immediate) }
        _ = try? Activity.request(attributes: QuickAtributos(conta: conta), content: conteudo, pushType: nil)
    }

    static func encerrar() async {
        for a in Activity<QuickAtributos>.activities { await a.end(nil, dismissalPolicy: .immediate) }
    }
}
#endif
