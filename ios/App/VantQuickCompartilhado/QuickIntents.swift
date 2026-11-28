import AppIntents
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// The two buttons of the quick sale widget. They OPEN the VANT (openAppWhenRun): the tap is only
/// queued here, with its own id and the account stamped by the app, and the app executes it through
/// the DEFCON's own code (same rules, offline queue, ranking, Open Finance). Nothing is registered
/// here, so nothing is ever shown as done before the app confirms it.
@available(iOS 17.0, *)
struct RegistrarVendaIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar venda rápida"
    static var description = IntentDescription("Abre a VANT e registra a venda rápida configurada no bloco do DEFCON em andamento.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult { QuickToque.registrar("venda"); return .result() }
}

@available(iOS 17.0, *)
struct RegistrarAbordagemIntent: AppIntent {
    static var title: LocalizedStringResource = "Registrar abordagem"
    static var description = IntentDescription("Abre a VANT e registra uma abordagem no bloco do DEFCON em andamento.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult { QuickToque.registrar("abordagem"); return .result() }
}

enum QuickToque {
    /// Posted in the app's process so the web side picks the tap up at once.
    static let aviso = Notification.Name("VantQuickAcao")

    static func registrar(_ tipo: String) {
        let agora = Date().timeIntervalSince1970 * 1000
        let acao = QuickArmazem.Acao(id: UUID().uuidString.lowercased(), tipo: tipo, criadoEm: agora, conta: QuickArmazem.conta)
        QuickArmazem.adicionar(acao)
        QuickArmazem.ultima = QuickArmazem.Ultima(id: acao.id, tipo: tipo, estado: "registrando", texto: nil, quando: agora)
        NotificationCenter.default.post(name: aviso, object: nil)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: "VantVendaRapida")
        #endif
    }
}
