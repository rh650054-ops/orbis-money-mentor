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
    /// V2: the server's option this button shows ("p:<produto>:<qtd>", "v:<centavos>", "c") and its
    /// price. The server rebuilds its options and charges ITS copy; a changed price is refused.
    @Parameter(title: "Opção") var opcao: String
    @Parameter(title: "Valor") var valor: Double
    init() { origem = "widget"; opcao = ""; valor = 0 }
    init(origem: String, opcao: String = "", valor: Double = 0) { self.origem = origem; self.opcao = opcao; self.valor = valor }
    func perform() async throws -> some IntentResult {
        await QuickAcao.executar("venda", origem: origem, opcao: opcao.isEmpty ? nil : opcao, valor: valor > 0 ? valor : nil)
        return .result()
    }
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
    static func executar(_ tipo: String, origem: String, opcao: String? = nil, valor: Double? = nil) async {
        let nome = tipo == "abordagem" ? "Abordagem" : "Venda"
        let confirmada = tipo == "venda" && valor != nil ? "Venda de \(reais(valor!)) confirmada" : "\(nome) confirmada"
        let agora = Date().timeIntervalSince1970 * 1000
        let id = UUID().uuidString.lowercased()
        guard QuickArmazem.interativo, let conta = QuickArmazem.conta else {
            await anunciar(id: id, tipo: tipo, estado: "recusada", texto: "Registro pelo widget indisponível", ok: false)
            return
        }
        // a previous tap still without an answer is cleared up first (no new tap hides it)
        await resolverDuvida()
        QuickArmazem.ultima = .init(id: id, tipo: tipo, estado: "registrando", texto: nil, quando: agora)
        recarregar()
        switch await QuickServidor.enviar(acao: tipo, id: id, origem: origem, opcao: opcao, valor: valor) {
        case .confirmada(let painel):
            // the account may have changed while waiting: never show one account's numbers to another
            guard QuickArmazem.conta == conta else { return }
            if let painel { QuickArmazem.guardarPainelServidor(conta: conta, painel) }
            await anunciar(id: id, tipo: tipo, estado: "confirmada", texto: confirmada, ok: true, painel: painel, conta: conta)
        case .recusada(let motivo, let painel):
            // nothing was written; a fresh panel (new options, e.g. a changed price) still redraws the buttons
            if let painel, QuickArmazem.conta == conta {
                QuickArmazem.guardarPainelServidor(conta: conta, painel)
            }
            await anunciar(id: id, tipo: tipo, estado: "recusada", texto: QuickServidor.frase(motivo), ok: false, painel: painel, conta: conta)
        case .inconclusiva:
            // kept to be asked about later by its id: never shown as done, never sent again as new
            QuickArmazem.duvida = .init(id: id, tipo: tipo, conta: conta, quando: Date().timeIntervalSince1970 * 1000)
            await anunciar(id: id, tipo: tipo, estado: "nao_confirmada", texto: "Sem conexão — \(nome.lowercased()) não confirmada", ok: false, conta: conta)
        }
    }

    /// Asks the server about the tap whose answer never arrived, by ITS id: "existe" → confirmed with
    /// the server's numbers; "não existe" → not registered (and the server closed that id, so the lost
    /// request can never land later). No answer again → asked again next time. Never registers.
    static func resolverDuvida() async {
        guard let d = QuickArmazem.duvida else { return }
        guard d.conta == QuickArmazem.conta else { QuickArmazem.duvida = nil; return }   // another account now
        let nome = d.tipo == "abordagem" ? "Abordagem" : "Venda"
        switch await QuickServidor.situacao(id: d.id) {
        case .existe(let painel):
            QuickArmazem.duvida = nil
            if let painel { QuickArmazem.guardarPainelServidor(conta: d.conta, painel) }
            await anunciar(id: d.id, tipo: d.tipo, estado: "confirmada", texto: "\(nome) confirmada", ok: true, painel: painel, conta: d.conta)
        case .naoExiste(let painel):
            QuickArmazem.duvida = nil
            await anunciar(id: d.id, tipo: d.tipo, estado: "recusada", texto: "\(nome) não registrada — toque de novo", ok: false, painel: painel, conta: d.conta)
        case .desconhecida:
            return
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

    /// R$ 1.234,50 (here and not Estilo: this file is also compiled into the app, Estilo is not)
    static func reais(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency; f.locale = Locale(identifier: "pt_BR"); f.currencyCode = "BRL"
        f.maximumFractionDigits = 2; f.minimumFractionDigits = 2
        return f.string(from: NSNumber(value: v)) ?? "R$ \(v)"
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
    /// The server's answer into the running Live Activity of the account, through QuickOrdem: an
    /// older answer, another session's or an older block's is dropped (the tap's own line still
    /// shows). It never creates an activity and never touches another account's.
    static func aplicar(conta: String, painel: QuickServidor.Painel?, aviso: String?, avisoOk: Bool) async {
        guard let atividade = Activity<QuickAtributos>.activities.first(where: { $0.attributes.conta == conta }) else { return }
        var e = atividade.content.state
        if let p = painel, let v = QuickOrdem.comServidor(e.vista, p) {
            e.usar(v)
            if let ops = p.opcoes { e.botoes = ops.prefix(2).map { .init(id: $0.id, valor: $0.valor, rotulo: $0.legenda) } }
        }
        e.interativo = QuickArmazem.interativo
        e.aviso = aviso
        e.avisoOk = avisoOk
        await atividade.update(ActivityContent(state: e, staleDate: e.blocoFim.addingTimeInterval(15 * 60)))
    }
}
#endif
