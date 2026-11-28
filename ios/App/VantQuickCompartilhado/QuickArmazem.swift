import Foundation

/// VANT Quick's storage shared by the app and the widget extension (App Group).
/// Display numbers and the taps waiting for the app only: NO token, NO session, NO password.
/// Wiped when the account signs out or changes (QuickArmazem.limpar, called by the app).
enum QuickArmazem {
    static let grupo = "group.app.vant.vendas"
    private static var base: UserDefaults? { UserDefaults(suiteName: grupo) }

    private enum Chave {
        static let conta = "quick.conta", painel = "quick.painel", config = "quick.config"
        static let pendentes = "quick.pendentes", ultima = "quick.ultima"
        static let todas = [conta, painel, config, pendentes, ultima]
    }

    /// One tap on the widget. It carries no amount: the app uses its own configuration.
    struct Acao: Codable, Equatable {
        let id: String
        let tipo: String          // "venda" | "abordagem"
        let criadoEm: Double      // ms since epoch
        let conta: String?        // the account stamped by the app when the tap happened
    }

    struct Painel: Codable {
        let conta: String, data: String
        let faturamento: Double, meta: Double, restante: Double, progresso: Double
        let vendas: Int, abordagens: Int
        let conversao: Double?
        let atualizadoEm: Double
    }

    struct Config: Codable { let valor: Double; let rotulo: String }

    /// What the quick sale widget says about the last tap.
    struct Ultima: Codable {
        let id: String, tipo: String
        let estado: String        // "registrando" | "pendente_sync" | "confirmada" | "recusada"
        let texto: String?
        let quando: Double
    }

    private static func ler<T: Decodable>(_ tipo: T.Type, _ chave: String) -> T? {
        guard let dados = base?.data(forKey: chave) else { return nil }
        return try? JSONDecoder().decode(T.self, from: dados)
    }
    private static func gravar<T: Encodable>(_ valor: T?, _ chave: String) {
        guard let valor, let dados = try? JSONEncoder().encode(valor) else { base?.removeObject(forKey: chave); return }
        base?.set(dados, forKey: chave)
    }

    static var conta: String? {
        get { base?.string(forKey: Chave.conta) }
        set { if let newValue { base?.set(newValue, forKey: Chave.conta) } else { base?.removeObject(forKey: Chave.conta) } }
    }
    static var painel: Painel? { get { ler(Painel.self, Chave.painel) } set { gravar(newValue, Chave.painel) } }
    static var config: Config? { get { ler(Config.self, Chave.config) } set { gravar(newValue, Chave.config) } }
    static var ultima: Ultima? { get { ler(Ultima.self, Chave.ultima) } set { gravar(newValue, Chave.ultima) } }
    static var pendentes: [Acao] { ler([Acao].self, Chave.pendentes) ?? [] }

    /// A new tap. Each tap has its own id (two real sales in a row are two taps). Taps older than
    /// a day are dropped and the queue is capped, so a forgotten widget never piles up actions.
    static func adicionar(_ a: Acao) {
        let limite = Date().timeIntervalSince1970 * 1000 - 86_400_000
        var fila = pendentes.filter { $0.criadoEm > limite && $0.id != a.id }
        fila.append(a)
        gravar(Array(fila.suffix(50)), Chave.pendentes)
    }

    static func remover(_ id: String) { gravar(pendentes.filter { $0.id != id }, Chave.pendentes) }

    /// Sign-out or account switch: everything of VANT Quick goes.
    static func limpar() { for c in Chave.todas { base?.removeObject(forKey: c) } }
}
