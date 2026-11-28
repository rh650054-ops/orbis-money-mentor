import SwiftUI

/// VANT's look for the widgets: black, gold, large numbers you can read at a glance on the street.
enum Estilo {
    static let ouro = Color(red: 245 / 255, green: 184 / 255, blue: 0)
    static let ouroClaro = Color(red: 1, green: 229 / 255, blue: 138 / 255)
    static let texto = Color(red: 244 / 255, green: 241 / 255, blue: 234 / 255)
    static let apagado = Color(red: 143 / 255, green: 137 / 255, blue: 124 / 255)
    static let trilho = Color.white.opacity(0.10)
    static let verde = Color(red: 73 / 255, green: 217 / 255, blue: 138 / 255)
    static let coral = Color(red: 1, green: 107 / 255, blue: 91 / 255)

    private static let moeda: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency; f.locale = Locale(identifier: "pt_BR"); f.currencyCode = "BRL"
        f.maximumFractionDigits = 2; f.minimumFractionDigits = 2
        return f
    }()
    static func reais(_ v: Double) -> String { moeda.string(from: NSNumber(value: v)) ?? "R$ 0,00" }
    /// Without cents above R$ 1.000, so the big number always fits.
    static func reaisCurto(_ v: Double) -> String {
        guard v >= 1000 else { return reais(v) }
        let f = moeda.copy() as! NumberFormatter
        f.maximumFractionDigits = 0; f.minimumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? reais(v)
    }
    static func porcento(_ v: Double) -> String { "\(Int((v * 100).rounded()))%" }

    /// Today in Brazil (YYYY-MM-DD), the same day key the app writes.
    static func hojeNoBrasil(_ agora: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "America/Sao_Paulo"); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: agora)
    }
    static func hora(_ ms: Double) -> String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "America/Sao_Paulo"); f.dateFormat = "HH:mm"
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }
}

/// A gold progress bar (0...1).
struct BarraOuro: View {
    let valor: Double
    var altura: CGFloat = 8
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Estilo.trilho)
                Capsule().fill(LinearGradient(colors: [Estilo.ouroClaro, Estilo.ouro], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(altura, g.size.width * min(1, max(0, valor))))
            }
        }
        .frame(height: altura)
        .accessibilityLabel("Progresso \(Estilo.porcento(valor))")
    }
}
