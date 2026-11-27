import Capacitor
import Foundation
import StoreKit
import UIKit

/// The Capacitor side of the bridge: it only translates calls. The rules are in LojaApple (native)
/// and in src/features/assinatura-apple (the app), and the decision about access is the server's.
@objc(VantStorekitPlugin)
public class VantStorekitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VantStorekitPlugin"
    public let jsName = "VantStorekit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "podePagar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "produtos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "comprar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "concluir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendentes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "direitos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sincronizar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gerenciar", returnType: CAPPluginReturnPromise)
    ]

    private let loja = LojaApple()
    private var escuta: Task<Void, Never>?

    override public func load() {
        // from the first moment of the app: a renewal or an approval can arrive at any time.
        // retainUntilConsumed: an update that arrives before the web side is listening is kept.
        escuta = loja.ouvir { [weak self] dados in
            self?.notifyListeners("transacao", data: dados, retainUntilConsumed: true)
        }
    }

    deinit { escuta?.cancel() }

    @objc func podePagar(_ call: CAPPluginCall) {
        call.resolve(["pode": AppStore.canMakePayments])
    }

    @objc func produtos(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do { call.resolve(["produtos": try await loja.produtos(ids)]) } catch { call.reject("produtos", LojaApple.codigo(error)) }
        }
    }

    @objc func comprar(_ call: CAPPluginCall) {
        guard let produto = call.getString("produto"), let conta = UUID(uuidString: call.getString("conta") ?? "") else {
            call.reject("produto e conta sao obrigatorios", "argumentos")
            return
        }
        Task {
            do { call.resolve(try await loja.comprar(produto, conta: conta)) } catch { call.reject("comprar", LojaApple.codigo(error)) }
        }
    }

    @objc func concluir(_ call: CAPPluginCall) {
        guard let transacao = call.getString("transacao") else {
            call.reject("transacao obrigatoria", "argumentos")
            return
        }
        Task { call.resolve(["concluida": await loja.concluir(transacao)]) }
    }

    @objc func pendentes(_ call: CAPPluginCall) {
        Task { call.resolve(["transacoes": await loja.pendentes()]) }
    }

    @objc func direitos(_ call: CAPPluginCall) {
        Task { call.resolve(["transacoes": await loja.direitos()]) }
    }

    @objc func sincronizar(_ call: CAPPluginCall) {
        Task {
            do { try await loja.sincronizar(); call.resolve() } catch { call.reject("sincronizar", LojaApple.codigo(error)) }
        }
    }

    /// Apple's own sheet to change or cancel a subscription.
    @objc func gerenciar(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let cena = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("sem janela", "sem_janela")
                return
            }
            do { try await AppStore.showManageSubscriptions(in: cena); call.resolve() } catch { call.reject("gerenciar", LojaApple.codigo(error)) }
        }
    }
}
