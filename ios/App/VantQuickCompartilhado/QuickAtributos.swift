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
        /// review 28/11: the DEFCON session drawn, and the server time of the last answer drawn
        /// (QuickOrdem drops older answers and answers of another session)
        var sessao: String? = nil
        var versao: Double? = nil

        var vista: QuickVista {
            QuickVista(sessao: sessao, versao: versao, bloco: bloco, totalBlocos: totalBlocos, blocoInicio: blocoInicio, blocoFim: blocoFim,
                       pausado: pausado, faturamentoBloco: faturamentoBloco, metaHora: metaHora, vendasBloco: vendasBloco,
                       faturamentoDia: faturamentoDia, metaDia: metaDia, vendasDia: vendasDia, abordagensDia: abordagensDia, rapidaValor: rapidaValor)
        }
        mutating func usar(_ v: QuickVista) {
            sessao = v.sessao; versao = v.versao; bloco = v.bloco; totalBlocos = v.totalBlocos
            blocoInicio = v.blocoInicio; blocoFim = v.blocoFim; pausado = v.pausado
            faturamentoBloco = v.faturamentoBloco; metaHora = v.metaHora; vendasBloco = v.vendasBloco
            faturamentoDia = v.faturamentoDia; metaDia = v.metaDia; vendasDia = v.vendasDia; abordagensDia = v.abordagensDia
            rapidaValor = v.rapidaValor
        }
    }

    /// One quick sale button of the lock screen: the server's option id and the price drawn on it.
    struct Botao: Codable, Hashable {
        var id: String
        var valor: Double
        var rotulo: String
    }
}
#endif
