import Foundation

/// The call to the vant-quick edge function. The SERVER decides and answers; this only carries the
/// tap (its id, its type) and reports exactly what came back:
///  - .confirmada: the server answered ok, with its own totals (the only case shown as done);
///  - .recusada: the server refused (no DEFCON, paused, no value, limits...), nothing was written;
///  - .inconclusiva: no valid answer (no signal, timeout, server error). The SAME id is resent a
///    couple of times right away (the server applies an id once); if it is still unknown, the widget
///    says "não confirmada" and nothing is shown as done. No queue for later.
enum QuickServidor {
    struct Painel: Codable {
        var sessao: String?
        var data: String?
        var faturamento: Double?
        var meta: Double?
        var restante: Double?
        var progresso: Double?
        var vendas: Int?
        var abordagens: Int?
        var conversao: Double?
        var bloco: Int?
        var totalBlocos: Int?
        var blocoEstado: String?
        var blocoInicio: String?
        var blocoFim: String?
        var rapida: Rapida?
        struct Rapida: Codable { var valor: Double; var metodo: String }
        /// the current block (what the Dynamic Island draws), from the DEFCON's own columns
        var faturamentoBloco: Double?
        var metaHora: Double?
        var vendasBloco: Int?
        /// the server's clock when this panel was built (ms): orders answers that arrive out of order
        var geradoEm: Double?
        /// V2: the quick sale options the SERVER built (today's products and tiers, today's values,
        /// the VANT Quick config), best first. A tap names one; the server charges its own copy.
        var opcoes: [Opcao]?
    }
    struct Opcao: Codable, Hashable {
        var id: String
        var valor: Double
        var qtd: Int?
        var nome: String?
        var metodo: String?
        var fonte: String?
        /// the server's label: "1 unidade", "2 unidades"; "Trufa · 1 un" when two products are listed
        /// (two products at the same price must never look the same); "Venda rápida" otherwise
        var rotulo: String? = nil
        var legenda: String {
            if let rotulo, !rotulo.isEmpty { return rotulo }
            guard fonte == "produto", let q = qtd else { return "Venda rápida" }
            return q == 1 ? "1 unidade" : "\(q) unidades"
        }
    }
    private struct Resposta: Codable { var ok: Bool; var motivo: String?; var aplicado: Bool?; var repetido: Bool?; var existe: Bool?; var painel: Painel? }

    /// A refusal may bring the server's fresh panel (e.g. the option changed): the widget redraws.
    enum Resultado { case confirmada(Painel?), recusada(String, Painel?), inconclusiva }
    enum Situacao { case existe(Painel?), naoExiste(Painel?), desconhecida }

    /// Asks the server about a tap whose answer never arrived. "não existe" also CLOSES the id on
    /// the server, so the original request can never land later: the answer shown never changes.
    static func situacao(id: String) async -> Situacao {
        guard let url = endereco(), let token = QuickCofre.ler(),
              let dados = try? JSONSerialization.data(withJSONObject: ["acao": "status", "id": id, "origem": "widget"]) else { return .desconhecida }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = dados
        guard let (resp, http) = try? await URLSession.shared.data(for: req), let h = http as? HTTPURLResponse, h.statusCode == 200,
              let r = try? JSONDecoder().decode(Resposta.self, from: resp), r.ok, let existe = r.existe else { return .desconhecida }
        return existe ? .existe(r.painel) : .naoExiste(r.painel)
    }

    /// Base URL of the project (public, written by the app). Only https on supabase.co is accepted.
    static func endereco() -> URL? {
        guard let s = QuickArmazem.servidor, let u = URL(string: s), u.scheme == "https",
              let host = u.host, host.hasSuffix(".supabase.co") else { return nil }
        return u.appendingPathComponent("functions/v1/vant-quick")
    }

    static func enviar(acao: String, id: String?, origem: String, opcao: String? = nil, valor: Double? = nil) async -> Resultado {
        guard let url = endereco(), let token = QuickCofre.ler() else { return .recusada("credencial_invalida", nil) }
        var corpo: [String: Any] = ["acao": acao, "origem": origem]
        if let id { corpo["id"] = id }
        if acao == "venda", let opcao, !opcao.isEmpty { corpo["opcao"] = opcao }
        if acao == "venda", let valor, valor > 0 { corpo["valor"] = valor }
        guard let dados = try? JSONSerialization.data(withJSONObject: corpo) else { return .inconclusiva }
        let tentativas = acao == "painel" ? 1 : 3
        for n in 0..<tentativas {
            if n > 0 { try? await Task.sleep(nanoseconds: UInt64(n) * 700_000_000) }
            var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = dados
            guard let (resp, http) = try? await URLSession.shared.data(for: req), let h = http as? HTTPURLResponse else { continue }
            guard let r = try? JSONDecoder().decode(Resposta.self, from: resp) else { continue }
            if h.statusCode == 200 && r.ok { return .confirmada(r.painel) }
            // the server answered with a refusal: final, and nothing was written
            if h.statusCode < 500 || r.motivo == "desativado" { return .recusada(r.motivo ?? "recusada", r.painel) }
            // 5xx: outcome unknown -> resend the same id
        }
        return .inconclusiva
    }

    /// The seller's words for each refusal: short, about what to do, never a technical code.
    /// Shown only as the discreet "last operation" line, never as a fixed part of the layout.
    static func frase(_ motivo: String) -> String {
        switch motivo {
        case "sem_defcon": return "Comece o DEFCON para registrar"
        case "bloco_parado": return "Bloco em pausa — não registrada"
        case "sem_valor": return "Faça a 1ª venda no DEFCON"
        case "rapido_demais": return "Toque de novo"
        case "limite_do_dia": return "Limite do dia atingido"
        case "opcao_mudou", "opcao_indisponivel": return "Preço atualizado — toque de novo"
        case "atualize_outro_aparelho": return "Atualize a VANT no outro aparelho"
        case "defcon_nao_habilitado", "desativado", "bloqueado": return "Registro rápido indisponível"
        case "credencial_invalida", "credencial_expirada": return "Abra a VANT para reconectar"
        case "encerrada": return "Não registrada — toque de novo"
        default: return "Não registrada"
        }
    }
}


// MARK: - Which numbers may replace what is shown (review of 28/11/2026)
//
// Taps, pulls and the widgets' own reads answer out of order; the app also writes its own copy of
// the DEFCON. Rules, all decided here so they can run as plain tests (no ActivityKit / WidgetKit):
//  - a newer server answer always wins, even with LESS revenue (a reversed sale is a valid drop):
//    the rule is "newer", never "higher";
//  - an older answer never replaces a newer one ("geradoEm", the server's clock; never the phone's);
//  - an answer of another DEFCON session never updates the shown session (late reply after a restart);
//  - within one session, an answer for an older block never comes back over a newer block;
//  - money and timing of the Live Activity always come from ONE source at a time, so a new block's
//    money is never drawn with an old block's countdown, or the other way round.

/// The Live Activity's numbers, without layout.
struct QuickVista: Equatable {
    var sessao: String? = nil
    /// "geradoEm" of the last server answer drawn (nil: only the app's numbers so far)
    var versao: Double? = nil
    var bloco: Int
    var totalBlocos: Int
    var blocoInicio: Date
    var blocoFim: Date
    var pausado: Bool
    var faturamentoBloco: Double
    var metaHora: Double
    var vendasBloco: Int
    var faturamentoDia: Double
    var metaDia: Double
    var vendasDia: Int
    var abordagensDia: Int
    var rapidaValor: Double?
}

enum QuickOrdem {
    private static let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    static func data(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    /// The Live Activity after a server answer, or nil when the answer must be dropped.
    static func comServidor(_ atual: QuickVista, _ p: QuickServidor.Painel) -> QuickVista? {
        guard let sessao = p.sessao else { return nil }                             // no DEFCON in it
        if let s = atual.sessao, s != sessao { return nil }                         // another session
        if let va = atual.versao, let vn = p.geradoEm, vn < va { return nil }      // older answer
        if atual.sessao == sessao, let b = p.bloco, b < atual.bloco { return nil }  // older block
        var v = atual
        v.sessao = sessao
        if let g = p.geradoEm { v.versao = max(g, atual.versao ?? g) }
        // one snapshot: day, block money and block timing together
        v.faturamentoDia = p.faturamento ?? v.faturamentoDia
        v.metaDia = p.meta ?? v.metaDia
        v.vendasDia = p.vendas ?? v.vendasDia
        v.abordagensDia = p.abordagens ?? v.abordagensDia
        v.rapidaValor = p.rapida?.valor ?? v.rapidaValor
        if let b = p.bloco { v.bloco = b }
        if let t = p.totalBlocos { v.totalBlocos = t }
        if let i = data(p.blocoInicio), let f = data(p.blocoFim) { v.blocoInicio = i; v.blocoFim = f }
        if let est = p.blocoEstado { v.pausado = est != "running" }
        if let x = p.faturamentoBloco { v.faturamentoBloco = x }
        if let x = p.metaHora { v.metaHora = x }
        if let x = p.vendasBloco { v.vendasBloco = x }
        return v
    }

    /// The Live Activity after the app writes its own copy of the DEFCON. Not interactive: the app's
    /// copy, as always. Interactive, same session and same block as the server answer already drawn:
    /// the server's money and counts stay (the app's copy may be older than a tap it has not seen),
    /// the app's timing of THAT block is taken (pause / resume happen in the app, also offline).
    /// Money and timing then describe the same block number. Another block or another session: the
    /// app's copy entirely (the app moved the DEFCON), keeping the session's answer stamp so an
    /// older answer cannot come back over it.
    static func comApp(_ atual: QuickVista?, _ app: QuickVista, interativo: Bool) -> QuickVista {
        guard interativo, let a = atual else { return app }
        let mesmaSessao = a.sessao != nil && a.sessao == app.sessao
        if mesmaSessao, a.versao != nil, a.bloco == app.bloco {
            var v = a
            v.blocoInicio = app.blocoInicio
            v.blocoFim = app.blocoFim
            v.pausado = app.pausado
            v.totalBlocos = max(a.totalBlocos, app.totalBlocos)   // "+1h" adds a block to the plan
            return v
        }
        var v = app
        v.versao = mesmaSessao ? a.versao : nil
        // review 28/11: a new block of the same session. The day belongs to the session, not to the
        // block: keep the server's day figures (the app's copy may be behind a tap it has not seen);
        // the block's money, counts and timing are the app's new block. The pull right after this
        // write brings the server's figures of the new block.
        if mesmaSessao, a.versao != nil {
            v.faturamentoDia = a.faturamentoDia
            v.metaDia = a.metaDia
            v.vendasDia = a.vendasDia
            v.abordagensDia = a.abordagensDia
        }
        return v
    }

    /// May a server answer replace the one cached for the widgets? Same account only; then the
    /// newer one wins (also when it is another session: a new day, a restarted DEFCON).
    static func substituiCache(_ novo: QuickServidor.Painel, conta: String, atual: QuickArmazem.PainelDoServidor?) -> Bool {
        guard let a = atual, a.conta == conta else { return true }
        guard let vn = novo.geradoEm, let va = a.painel.geradoEm else { return true }
        return vn >= va
    }
}


// MARK: - Serial updates and batched pulls (review of 28/11/2026)

/// Runs async operations strictly one after the other, in the order they were asked for. The Live
/// Activity is read-modified-written by the app's mirror and by every tap's answer: without this,
/// one could read the state, the other write a newer one, and the first write back over it.
actor QuickFila {
    static let atividade = QuickFila()
    private var cauda: Task<Void, Never>? = nil
    func rodar(_ op: @escaping @Sendable () async -> Void) async {
        let anterior = cauda
        let t = Task { await anterior?.value; await op() }
        cauda = t
        await t.value
    }
}

/// Batches server pulls: at most one in flight; requests while it runs become ONE more pull after
/// it (so the last request is always followed by a pull that started after it), with a short gap
/// between pulls. A burst of DEFCON changes (a sale moves money, counts and the block at once) is
/// one or two requests, not one per change.
actor QuickAgrupador {
    private var rodando = false
    private var pendente = false
    private let intervalo: UInt64
    private let tarefa: @Sendable () async -> Void
    init(intervaloMs: UInt64, tarefa: @escaping @Sendable () async -> Void) {
        self.intervalo = intervaloMs * 1_000_000
        self.tarefa = tarefa
    }
    func pedir() async {
        if rodando { pendente = true; return }
        rodando = true
        repeat {
            pendente = false
            await tarefa()
            if intervalo > 0 { try? await Task.sleep(nanoseconds: intervalo) }
        } while pendente
        rodando = false
    }
}
