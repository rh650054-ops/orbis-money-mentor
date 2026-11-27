import Foundation
import StoreKit

/// Everything VANT asks StoreKit 2, with no Capacitor in it (so the native tests drive it directly).
///
/// What this class NEVER does: decide that someone has access, or finish a transaction on its own.
/// It hands the app the transaction exactly as Apple signed it (the JWS). The server checks the
/// signature and stores the right; only then the app calls `concluir`. Until that call, StoreKit
/// keeps the transaction as "unfinished" and delivers it again on every launch: that is what lets
/// a purchase be recovered after a failure without the customer paying twice.
public enum ErroLoja: Error {
    case produtoIndisponivel
}

public final class LojaApple {
    public init() {}

    /// One transaction as the app receives it. `conta` is the VANT account Apple signed into the
    /// purchase (appAccountToken); `jws` is what the server verifies.
    public static func dados(_ resultado: VerificationResult<Transaction>) -> [String: Any] {
        let t = resultado.unsafePayloadValue
        var verificada = false
        if case .verified = resultado { verificada = true }
        var d: [String: Any] = [
            "jws": resultado.jwsRepresentation,
            "transacao": String(t.id),
            "original": String(t.originalID),
            "produto": t.productID,
            "verificadaNoAparelho": verificada,
            "comprada": Int(t.purchaseDate.timeIntervalSince1970 * 1000),
            "substituida": t.isUpgraded
        ]
        if let conta = t.appAccountToken { d["conta"] = conta.uuidString.lowercased() }
        if let fim = t.expirationDate { d["expira"] = Int(fim.timeIntervalSince1970 * 1000) }
        if let revogada = t.revocationDate { d["revogada"] = Int(revogada.timeIntervalSince1970 * 1000) }
        return d
    }

    private static func unidade(_ u: Product.SubscriptionPeriod.Unit) -> String {
        switch u {
        case .day: return "dia"
        case .week: return "semana"
        case .month: return "mes"
        case .year: return "ano"
        @unknown default: return "outro"
        }
    }

    /// Products with the price and the texts of the customer's own App Store (never a fixed value).
    public func produtos(_ ids: [String]) async throws -> [[String: Any]] {
        let lista = try await Product.products(for: ids)
        return lista.map { p in
            var d: [String: Any] = [
                "id": p.id,
                "nome": p.displayName,
                "descricao": p.description,
                "preco": NSDecimalNumber(decimal: p.price).stringValue,
                "precoFormatado": p.displayPrice,
                "moeda": p.priceFormatStyle.currencyCode
            ]
            if let s = p.subscription {
                d["grupo"] = s.subscriptionGroupID
                d["periodo"] = ["unidade": Self.unidade(s.subscriptionPeriod.unit), "valor": s.subscriptionPeriod.value]
            }
            return d
        }
    }

    /// Opens Apple's own purchase sheet. The VANT account goes inside the purchase, signed by Apple.
    /// The transaction is returned UNFINISHED.
    public func comprar(_ id: String, conta: UUID) async throws -> [String: Any] {
        guard let produto = try await Product.products(for: [id]).first else { throw ErroLoja.produtoIndisponivel }
        let resultado = try await produto.purchase(options: [.appAccountToken(conta)])
        switch resultado {
        case .success(let verificacao):
            var d = Self.dados(verificacao)
            d["estado"] = "comprada"
            return d
        case .pending:
            // Ask to Buy, or the bank still has to approve: the transaction arrives later through `ouvir`
            return ["estado": "pendente", "produto": id]
        case .userCancelled:
            return ["estado": "cancelada", "produto": id]
        @unknown default:
            return ["estado": "desconhecido", "produto": id]
        }
    }

    /// Paid transactions the app has not finished yet (the server has not confirmed them).
    public func pendentes() async -> [[String: Any]] {
        var lista: [[String: Any]] = []
        for await r in Transaction.unfinished { lista.append(Self.dados(r)) }
        return lista
    }

    /// What this Apple account is entitled to right now (used by "Restaurar compras").
    public func direitos() async -> [[String: Any]] {
        var lista: [[String: Any]] = []
        for await r in Transaction.currentEntitlements { lista.append(Self.dados(r)) }
        return lista
    }

    /// Finishes ONE transaction, by id. Called only after the server stored it.
    public func concluir(_ transacao: String) async -> Bool {
        for await r in Transaction.unfinished {
            let t = r.unsafePayloadValue
            if String(t.id) == transacao {
                await t.finish()
                return true
            }
        }
        return false
    }

    /// Asks the App Store again for this Apple account's purchases (may ask for the Apple password).
    public func sincronizar() async throws {
        try await AppStore.sync()
    }

    /// Renewals, refunds, approvals of a pending purchase, purchases made outside the app.
    public func ouvir(_ aoChegar: @escaping ([String: Any]) -> Void) -> Task<Void, Never> {
        Task.detached {
            for await r in Transaction.updates { aoChegar(Self.dados(r)) }
        }
    }

    /// A short code the app can act on, instead of a system message.
    public static func codigo(_ erro: Error) -> String {
        if erro is ErroLoja { return "produto_indisponivel" }
        if let e = erro as? StoreKitError {
            switch e {
            case .networkError: return "sem_internet"
            case .userCancelled: return "cancelada"
            case .notAvailableInStorefront: return "produto_indisponivel"
            default: return "falha_na_loja"
            }
        }
        if let e = erro as? Product.PurchaseError {
            switch e {
            case .productUnavailable: return "produto_indisponivel"
            case .purchaseNotAllowed: return "compra_nao_permitida"
            default: return "falha_na_loja"
            }
        }
        if (erro as NSError).domain == NSURLErrorDomain { return "sem_internet" }
        return "falha_na_loja"
    }
}
