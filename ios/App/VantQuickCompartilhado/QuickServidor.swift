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
    }
    private struct Resposta: Codable { var ok: Bool; var motivo: String?; var aplicado: Bool?; var repetido: Bool?; var painel: Painel? }

    enum Resultado { case confirmada(Painel?), recusada(String), inconclusiva }

    /// Base URL of the project (public, written by the app). Only https on supabase.co is accepted.
    static func endereco() -> URL? {
        guard let s = QuickArmazem.servidor, let u = URL(string: s), u.scheme == "https",
              let host = u.host, host.hasSuffix(".supabase.co") else { return nil }
        return u.appendingPathComponent("functions/v1/vant-quick")
    }

    static func enviar(acao: String, id: String?, origem: String) async -> Resultado {
        guard let url = endereco(), let token = QuickCofre.ler() else { return .recusada("credencial_invalida") }
        var corpo: [String: Any] = ["acao": acao, "origem": origem]
        if let id { corpo["id"] = id }
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
            if h.statusCode < 500 || r.motivo == "desativado" { return .recusada(r.motivo ?? "recusada") }
            // 5xx: outcome unknown -> resend the same id
        }
        return .inconclusiva
    }

    /// The seller's words for each refusal.
    static func frase(_ motivo: String) -> String {
        switch motivo {
        case "sem_defcon": return "Comece o DEFCON para registrar"
        case "bloco_parado": return "Bloco em pausa"
        case "sem_valor": return "Defina o valor no VANT Quick"
        case "rapido_demais": return "Toque de novo"
        case "limite_do_dia": return "Limite do dia atingido"
        case "atualize_outro_aparelho": return "Atualize a VANT no outro aparelho"
        case "defcon_nao_habilitado", "desativado": return "Registro pelo widget indisponível"
        case "credencial_invalida", "credencial_expirada": return "Abra a VANT para reconectar"
        default: return "Não registrada"
        }
    }
}
