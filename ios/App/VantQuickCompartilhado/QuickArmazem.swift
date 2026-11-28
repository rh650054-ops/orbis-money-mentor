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
        if let pastaDeTeste { return pastaDeTeste }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: grupo)?
            .appendingPathComponent("vant-quick", isDirectory: true)
    }
    /// Only the plain-Swift tests set it (ios/VantQuickTestes): the app never does.
    static var pastaDeTeste: URL? = nil
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
    /// The newest panel the SERVER returned for the signed-in account (source of the totals).
    ///
    /// Review 28/11: the app, its intents and the widget extension write it from different
    /// processes. A read-compare-write of one file could let an older answer land last. So each
    /// answer is its own file, named by the server's time ("geradoEm", microseconds), created
    /// atomically; readers take the newest file of the account. No lock is needed (Apple's TN2408
    /// rules out NSFileCoordinator here, see `trava`), and no interleaving can make an older
    /// answer win. Old files are swept best-effort; the newest few always stay.
    struct PainelDoServidor: Codable { let conta: String; let quando: Double; let painel: QuickServidor.Painel }
    static var painelServidor: PainelDoServidor? {
        let conta = self.conta
        let candidatos = paineis().filter { $0.nome.carimbo > 0 }
        for c in candidatos.sorted(by: { $0.nome > $1.nome }) {
            if let p = (try? Data(contentsOf: c.url)).flatMap({ try? JSONDecoder().decode(PainelDoServidor.self, from: $0) }),
               conta == nil || p.conta == conta { return p }
        }
        // before this review there was one file: still read until the first new answer arrives
        if let antigo = ler(PainelDoServidor.self, Chave.painelServidor), conta == nil || antigo.conta == conta { return antigo }
        return nil
    }

    /// Stores a server answer for the widgets; false when a newer one of the account is already there.
    @discardableResult
    static func guardarPainelServidor(conta: String, _ p: QuickServidor.Painel) -> Bool {
        guard self.conta == conta, let dir = pastaPaineis else { return false }   // the account changed meanwhile
        guard QuickOrdem.substituiCache(p, conta: conta, atual: painelServidor) else { return false }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let nome = NomePainel(carimbo: Int64(((p.geradoEm ?? 0) * 1000).rounded()), unico: UUID().uuidString)
        escrever(PainelDoServidor(conta: conta, quando: Date().timeIntervalSince1970 * 1000, painel: p), dir.appendingPathComponent(nome.arquivo))
        varrerPaineis(manter: 4)
        if let antigo = arquivo(Chave.painelServidor) { try? FileManager.default.removeItem(at: antigo) }
        return true
    }

    static func apagarPainelServidor() {
        if let dir = pastaPaineis { try? FileManager.default.removeItem(at: dir) }
        gravar(Optional<Texto>.none, Chave.painelServidor)
    }

    private static var pastaPaineis: URL? { pasta?.appendingPathComponent("paineis-servidor", isDirectory: true) }
    struct NomePainel: Comparable {
        let carimbo: Int64, unico: String
        var arquivo: String { String(format: "%020lld", carimbo) + "-" + unico + ".json" }
        init(carimbo: Int64, unico: String) { self.carimbo = carimbo; self.unico = unico }
        init?(arquivo: String) {
            guard arquivo.hasSuffix(".json"), let traco = arquivo.firstIndex(of: "-"), let c = Int64(arquivo[..<traco]) else { return nil }
            carimbo = c; unico = String(arquivo[arquivo.index(after: traco)...].dropLast(5))
        }
        static func < (a: NomePainel, b: NomePainel) -> Bool { a.carimbo != b.carimbo ? a.carimbo < b.carimbo : a.unico < b.unico }
    }
    private static func paineis() -> [(nome: NomePainel, url: URL)] {
        guard let dir = pastaPaineis,
              let itens = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return [] }
        return itens.compactMap { u in NomePainel(arquivo: u.lastPathComponent).map { ($0, u) } }
    }
    private static func varrerPaineis(manter: Int) {
        let todos = paineis().sorted { $0.nome > $1.nome }
        for velho in todos.dropFirst(manter) { try? FileManager.default.removeItem(at: velho.url) }
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
        apagarPainelServidor()
        QuickCofre.apagar()
        let antigo = UserDefaults(suiteName: grupo)
        for c in ["quick.conta", "quick.painel", "quick.config", "quick.pendentes", "quick.ultima"] { antigo?.removeObject(forKey: c) }
    }
}
