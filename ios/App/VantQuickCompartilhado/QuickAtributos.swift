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
    }
}
#endif
