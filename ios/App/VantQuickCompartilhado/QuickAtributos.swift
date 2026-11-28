#if canImport(ActivityKit)
import ActivityKit
import Foundation

/// The DEFCON Live Activity (lock screen and Dynamic Island). Shared by the app (which starts,
/// updates and ends it with the real DEFCON session) and the widget extension (which draws it).
@available(iOS 16.1, *)
struct QuickAtributos: ActivityAttributes {
    /// The VANT account of the session (to end it when the account changes).
    var conta: String

    struct ContentState: Codable, Hashable {
        var blocoInicio: Date
        var blocoFim: Date
        var bloco: Int
        var totalBlocos: Int
        var faturamentoBloco: Double
        var metaHora: Double
        var vendasBloco: Int
        var pausado: Bool
        // the day, as the SERVER totals it (after a confirmed tap) or as the app shows it
        var faturamentoDia: Double = 0
        var metaDia: Double = 0
        var vendasDia: Int = 0
        var abordagensDia: Int = 0
        /// the VANT Quick sale value; nil = not set (the sale button then says so)
        var rapidaValor: Double? = nil
        /// the buttons register in the background (server allows it for this account)
        var interativo: Bool = false
        /// last tap: "Venda confirmada ✓", "Sem resposta — não confirmada", a refusal...
        var aviso: String? = nil
        var avisoOk: Bool = false
        /// V2: the quick sale buttons (the server's options, at most 2), each with the price it shows
        var botoes: [Botao]? = nil
    }

    /// One quick sale button of the lock screen: the server's option id and the price drawn on it.
    struct Botao: Codable, Hashable {
        var id: String
        var valor: Double
        var rotulo: String
    }
}
#endif
