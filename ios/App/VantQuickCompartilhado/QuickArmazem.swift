import Foundation

/// VANT Quick's storage shared by the app and the widget extension (App Group container).
/// Display numbers and the taps waiting for the app only: NO token, NO session, NO password.
/// Wiped when the account signs out or changes (QuickArmazem.limpar, called by the app).
///
/// Why files and not UserDefaults(suiteName:) (fix 28/11/2026, build 29): the widget runs in another
/// process, and a suite read there goes through the preferences cache, which can hand the widget an
/// old copy (the widget showed "Entre na VANT" while the app had the account). A small JSON file per
/// key, written atomically in the shared container and read from disk on every timeline, has no cache
/// between the two processes. And when the container is missing (App Group not granted) the code
/// says so (`disponivel == false`) instead of silently using a private, unshared store.
enum QuickArmazem {
    static let grupo = "group.app.vant.vendas"

    /// The shared folder; nil when this process has no App Group (then nothing is shared).
    static var pasta: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: grupo)?
            .appendingPathComponent("vant-quick", isDirectory: true)
    }
    static var disponivel: Bool { pasta != nil }

    private enum Chave {
        static let conta = "conta", painel = "painel", config = "config"
        static let pendentes = "pendentes", ultima = "ultima", leitura = "leitura"
        static let servidor = "servidor", interativo = "interativo", painelServidor = "painel-servidor", duvida = "duvida"
        static let todas = [conta, painel, config, pendentes, ultima, leitura, servidor, interativo, painelServidor, duvida]
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

    /// Written by the WIDGET each time it builds a timeline: what it saw. The app shows it in
    /// Minha Conta, so the shared channel can be checked on the phone itself.
    struct Leitura: Codable {
        let quando: Double
        let viuConta: String?
        let painelData: String?
    }

    private struct Texto: Codable { let v: String }

    private static func arquivo(_ chave: String) -> URL? { pasta?.appendingPathComponent(chave + ".json") }

    /// Serialises this process's writes (the app finishing a tap while another tap lands).
    /// No NSFileCoordinator: Apple's TN2408 warns it can deadlock in a shared container when one of
    /// the processes is suspended. An atomic write (temp file + rename) is enough: a reader sees the
    /// old file or the new one, never half of it. Duplicates stay impossible anyway: the app executes
    /// each tap id once (vant_quick_feitos + the sale id), whatever the queue says.
    private static let trava = NSLock()

    private static func ler<T: Decodable>(_ tipo: T.Type, _ chave: String) -> T? {
        guard let url = arquivo(chave), let dados = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: dados)
    }

    private static func escrever<T: Encodable>(_ valor: T?, _ url: URL) {
        if let valor, let dados = try? JSONEncoder().encode(valor) {
            // readable after the first unlock: the lock screen widget must read it with the phone locked
            try? dados.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } else {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func gravar<T: Encodable>(_ valor: T?, _ chave: String) {
        guard let url = arquivo(chave), let pasta else { return }
        trava.lock(); defer { trava.unlock() }
        try? FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)
        escrever(valor, url)
    }

    private static func alterarPendentes(_ f: ([Acao]) -> [Acao]) {
        guard let url = arquivo(Chave.pendentes), let pasta else { return }
        trava.lock(); defer { trava.unlock() }
        try? FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)
        let atuais = (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode([Acao].self, from: $0) } ?? []
        escrever(f(atuais), url)
    }

    static var conta: String? {
        get { ler(Texto.self, Chave.conta)?.v }
        set { gravar(newValue.map(Texto.init(v:)), Chave.conta) }
    }
    static var painel: Painel? { get { ler(Painel.self, Chave.painel) } set { gravar(newValue, Chave.painel) } }
    static var config: Config? { get { ler(Config.self, Chave.config) } set { gravar(newValue, Chave.config) } }
    static var ultima: Ultima? { get { ler(Ultima.self, Chave.ultima) } set { gravar(newValue, Chave.ultima) } }
    static var leitura: Leitura? { get { ler(Leitura.self, Chave.leitura) } set { gravar(newValue, Chave.leitura) } }
    static var pendentes: [Acao] { ler([Acao].self, Chave.pendentes) ?? [] }

    /// Project URL (public) for the vant-quick call, written by the app.
    static var servidor: String? {
        get { ler(Texto.self, Chave.servidor)?.v }
        set { gravar(newValue.map(Texto.init(v:)), Chave.servidor) }
    }
    /// The server allows this account to register from the widget / Live Activity (both switches on).
    static var interativo: Bool {
        get { ler(Texto.self, Chave.interativo)?.v == "1" }
        set { gravar(Texto(v: newValue ? "1" : "0"), Chave.interativo) }
    }
    /// The last panel the SERVER returned (source of the totals), with when it arrived.
    struct PainelDoServidor: Codable { let conta: String; let quando: Double; let painel: QuickServidor.Painel }
    static var painelServidor: PainelDoServidor? {
        get { ler(PainelDoServidor.self, Chave.painelServidor) }
        set { gravar(newValue, Chave.painelServidor) }
    }
    /// The last tap whose answer never arrived: asked about later (QuickAcao.resolverDuvida).
    struct Duvida: Codable { let id: String; let tipo: String; let conta: String; let quando: Double }
    static var duvida: Duvida? { get { ler(Duvida.self, Chave.duvida) } set { gravar(newValue, Chave.duvida) } }

    /// A new tap. Each tap has its own id (two real sales in a row are two taps). Taps older than
    /// a day are dropped and the queue is capped, so a forgotten widget never piles up actions.
    static func adicionar(_ a: Acao) {
        let limite = Date().timeIntervalSince1970 * 1000 - 86_400_000
        alterarPendentes { fila in Array((fila.filter { $0.criadoEm > limite && $0.id != a.id } + [a]).suffix(50)) }
    }

    static func remover(_ id: String) { alterarPendentes { $0.filter { $0.id != id } } }

    /// Sign-out or account switch: everything of VANT Quick goes (also the old UserDefaults keys of build 29).
    static func limpar() {
        for c in Chave.todas { gravar(Optional<Texto>.none, c) }
        QuickCofre.apagar()
        let antigo = UserDefaults(suiteName: grupo)
        for c in ["quick.conta", "quick.painel", "quick.config", "quick.pendentes", "quick.ultima"] { antigo?.removeObject(forKey: c) }
    }
}
