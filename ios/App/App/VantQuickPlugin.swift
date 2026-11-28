import Capacitor
import Foundation
import UIKit
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
        CAPPluginMethod(name: "guardarCredencial", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "definirInterativo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "atividade", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "limpar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise)
    ]

    /// Performance widget reloads: at most one per 30 s (WidgetKit budget), but never dropped. A change
    /// inside the window is reloaded when the window ends (build 29 dropped it: a sale right after the
    /// DEFCON started never reached the widget), and at once when the app goes to the background.
    private var ultimoRecarregarPainel = Date.distantPast
    private var recargaPendente: DispatchWorkItem?
    private var observador: NSObjectProtocol?
    private var observadorFundo: NSObjectProtocol?

    override public func load() {
        // coming back to the app: the widgets and the Live Activity re-read the SERVER's totals
        observador = NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in
            Task { await VantQuickPlugin.puxarDoServidor() }
        }
        // leaving the app (home screen, lock): the widgets get the last numbers right away
        observadorFundo = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            if let pendente = self.recargaPendente { pendente.cancel(); self.recargaPendente = nil; self.recarregarPainelAgora() }
            Task { await VantQuickPlugin.puxarDoServidor() }
        }
    }

    deinit {
        if let observador { NotificationCenter.default.removeObserver(observador) }
        if let observadorFundo { NotificationCenter.default.removeObserver(observadorFundo) }
    }

    private func recarregarPainelAgora() {
        ultimoRecarregarPainel = Date()
        WidgetCenter.shared.reloadTimelines(ofKind: "VantPainel")
    }

    private func recarregarPainel() {
        let espera = 30 - Date().timeIntervalSince(ultimoRecarregarPainel)
        if espera <= 0 { recargaPendente?.cancel(); recargaPendente = nil; recarregarPainelAgora(); return }
        guard recargaPendente == nil else { return }   // one trailing reload already scheduled
        let item = DispatchWorkItem { [weak self] in self?.recargaPendente = nil; self?.recarregarPainelAgora() }
        recargaPendente = item
        DispatchQueue.main.asyncAfter(deadline: .now() + espera, execute: item)
    }

    @objc func definirConta(_ call: CAPPluginCall) {
        // always written and always reloaded (once per app start / account change): build 29 reloaded
        // only when the value changed, so a widget that had read "no account" never asked again
        QuickArmazem.conta = call.getString("conta")
        DispatchQueue.main.async { WidgetCenter.shared.reloadAllTimelines() }
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

    /// The server's panel of this account (display only, no limit counted), into the widgets and
    /// the Live Activity. Only when this account may use VANT Quick interactive.
    static func puxarDoServidor() async {
        guard QuickArmazem.interativo, let conta = QuickArmazem.conta else { return }
        if case .confirmada(let p) = await QuickServidor.enviar(acao: "painel", id: nil, origem: "widget"), let p, QuickArmazem.conta == conta {
            QuickArmazem.painelServidor = .init(conta: conta, quando: Date().timeIntervalSince1970 * 1000, painel: p)
            WidgetCenter.shared.reloadAllTimelines()
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) { await QuickAtividadeServidor.aplicar(conta: conta, painel: p, aviso: nil, avisoOk: false) }
            #endif
        }
    }

    /// The device credential (shown once by the server) goes to the Keychain; the project URL (public)
    /// to the App Group. Never to UserDefaults, never logged.
    @objc func guardarCredencial(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), token.hasPrefix("vq1_"), token.count == 68,
              let servidor = call.getString("servidor"), servidor.hasPrefix("https://") else { return call.reject("dados") }
        guard QuickCofre.guardar(token) else { return call.reject("keychain") }
        QuickArmazem.servidor = servidor
        call.resolve()
    }

    @objc func definirInterativo(_ call: CAPPluginCall) {
        let ativo = call.getBool("ativo") ?? false
        if QuickArmazem.interativo != ativo {
            QuickArmazem.interativo = ativo
            if !ativo { QuickArmazem.painelServidor = nil }
            DispatchQueue.main.async { WidgetCenter.shared.reloadAllTimelines() }
        }
        if ativo { Task { await VantQuickPlugin.puxarDoServidor() } }
        call.resolve()
    }

    @objc func salvarPainel(_ call: CAPPluginCall) {
        // interactive: the server's panel is the one shown (the screen may not know a widget sale yet)
        if QuickArmazem.interativo { return call.resolve() }
        guard let bruto = call.getObject("painel"), let dados = try? JSONSerialization.data(withJSONObject: bruto),
              let painel = try? JSONDecoder().decode(QuickArmazem.Painel.self, from: dados),
              painel.conta == QuickArmazem.conta else { return call.resolve() }
        QuickArmazem.painel = painel
        DispatchQueue.main.async { [weak self] in self?.recarregarPainel() }
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
            vendasBloco: d["vendasBloco"] as? Int ?? 0, pausado: d["pausado"] as? Bool ?? false,
            faturamentoDia: d["faturamentoDia"] as? Double ?? 0, metaDia: d["metaDia"] as? Double ?? 0,
            vendasDia: d["vendasDia"] as? Int ?? 0, abordagensDia: d["abordagensDia"] as? Int ?? 0,
            rapidaValor: d["rapidaValor"] as? Double, interativo: QuickArmazem.interativo)
        Task {
            await GerenteAtividade.atualizar(conta: conta, estado: estado)
            // interactive: the day's numbers are the server's, on top of the app's block timing
            if QuickArmazem.interativo, let ps = QuickArmazem.painelServidor, ps.conta == conta {
                await QuickAtividadeServidor.aplicar(conta: conta, painel: ps.painel, aviso: nil, avisoOk: false)
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    /// Diagnosis for Minha Conta: is the App Group there, what the app wrote, what the widget last saw.
    @objc func estado(_ call: CAPPluginCall) {
        let conta = QuickArmazem.conta
        var r: [String: Any] = ["grupo": QuickArmazem.disponivel, "temConta": conta != nil]
        if let p = QuickArmazem.painel { r["painelData"] = p.data; r["painelEm"] = p.atualizadoEm }
        if let l = QuickArmazem.leitura {
            r["widgetLeuEm"] = l.quando
            r["widgetViuConta"] = l.viuConta != nil && l.viuConta == conta
            if let d = l.painelData { r["widgetPainelData"] = d }
        }
        call.resolve(r)
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
