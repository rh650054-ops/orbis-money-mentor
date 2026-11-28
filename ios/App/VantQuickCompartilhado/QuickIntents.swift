import AppIntents
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif
#if canImport(ActivityKit)
import ActivityKit
#endif

/// The sale and approach buttons of the home screen widget and of the lock screen Live Activity.
/// They run IN THE BACKGROUND, without opening the VANT (LiveActivityIntent: iOS runs perform() in
/// the app's process, invisibly), and only after the iPhone is unlocked (authenticationPolicy).
/// The tap is registered by the SERVER (vant-quick → SQL), with the account of the device credential
/// in the Keychain, and shown as done only when the server confirms it. No queue for later.
@available(iOS 17.0, *)
struct RegistrarVendaIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Registrar venda rápida"
    static var description = IntentDescription("Registra a venda rápida do VANT Quick no bloco do DEFCON em andamento.")
    static var isDiscoverable: Bool = false
    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
    @Parameter(title: "Origem") var origem: String
    init() { origem = "widget" }
    init(origem: String) { self.origem = origem }
    func perform() async throws -> some IntentResult { await QuickAcao.executar("venda", origem: origem); return .result() }
}

@available(iOS 17.0, *)
struct RegistrarAbordagemIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Registrar abordagem"
    static var description = IntentDescription("Registra uma abordagem no bloco do DEFCON em andamento.")
    static var isDiscoverable: Bool = false
    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
    @Parameter(title: "Origem") var origem: String
    init() { origem = "widget" }
    init(origem: String) { self.origem = origem }
    func perform() async throws -> some IntentResult { await QuickAcao.executar("abordagem", origem: origem); return .result() }
}

enum QuickAcao {
    static func executar(_ tipo: String, origem: String) async {
        let nome = tipo == "abordagem" ? "Abordagem" : "Venda"
        let agora = Date().timeIntervalSince1970 * 1000
        let id = UUID().uuidString.lowercased()
        guard QuickArmazem.interativo, let conta = QuickArmazem.conta else {
            await anunciar(id: id, tipo: tipo, estado: "recusada", texto: "Registro pelo widget indisponível", ok: false)
            return
        }
        QuickArmazem.ultima = .init(id: id, tipo: tipo, estado: "registrando", texto: nil, quando: agora)
        recarregar()
        switch await QuickServidor.enviar(acao: tipo, id: id, origem: origem) {
        case .confirmada(let painel):
            // the account may have changed while waiting: never show one account's numbers to another
            guard QuickArmazem.conta == conta else { return }
            if let painel { QuickArmazem.painelServidor = .init(conta: conta, quando: Date().timeIntervalSince1970 * 1000, painel: painel) }
            await anunciar(id: id, tipo: tipo, estado: "confirmada", texto: "\(nome) confirmada ✓", ok: true, painel: painel, conta: conta)
        case .recusada(let motivo):
            await anunciar(id: id, tipo: tipo, estado: "recusada", texto: QuickServidor.frase(motivo), ok: false, conta: conta)
        case .inconclusiva:
            await anunciar(id: id, tipo: tipo, estado: "nao_confirmada", texto: "Sem resposta — \(nome.lowercased()) não confirmada", ok: false, conta: conta)
        }
    }

    private static func anunciar(id: String, tipo: String, estado: String, texto: String, ok: Bool,
                                 painel: QuickServidor.Painel? = nil, conta: String? = nil) async {
        QuickArmazem.ultima = .init(id: id, tipo: tipo, estado: estado, texto: texto, quando: Date().timeIntervalSince1970 * 1000)
        recarregar()
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *), let conta { await QuickAtividadeServidor.aplicar(conta: conta, painel: painel, aviso: texto, avisoOk: ok) }
        #endif
    }

    static func recarregar() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}

#if canImport(ActivityKit)
/// Brings the running DEFCON Live Activity of the account up to the server's numbers. It never
/// creates one (the app does, with the real session) and never touches another account's.
@available(iOS 16.2, *)
enum QuickAtividadeServidor {
    private static let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static func data(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    static func aplicar(conta: String, painel: QuickServidor.Painel?, aviso: String?, avisoOk: Bool) async {
        guard let atividade = Activity<QuickAtributos>.activities.first(where: { $0.attributes.conta == conta }) else { return }
        var e = atividade.content.state
        if let p = painel {
            e.faturamentoDia = p.faturamento ?? e.faturamentoDia
            e.metaDia = p.meta ?? e.metaDia
            e.vendasDia = p.vendas ?? e.vendasDia
            e.abordagensDia = p.abordagens ?? e.abordagensDia
            e.rapidaValor = p.rapida?.valor ?? e.rapidaValor
            if let b = p.bloco { e.bloco = b }
            if let t = p.totalBlocos { e.totalBlocos = t }
            if let i = data(p.blocoInicio), let f = data(p.blocoFim) { e.blocoInicio = i; e.blocoFim = f }
            if let est = p.blocoEstado { e.pausado = est != "running" }
        }
        e.interativo = QuickArmazem.interativo
        e.aviso = aviso
        e.avisoOk = avisoOk
        await atividade.update(ActivityContent(state: e, staleDate: e.blocoFim.addingTimeInterval(15 * 60)))
    }
}
#endif
