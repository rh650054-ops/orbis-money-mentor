import Foundation
import Security

/// VANT Quick's device credential, in the iPhone KEYCHAIN (never in UserDefaults or the App Group
/// files). Shared by the app and the widget extension through the App Group, which iOS also accepts
/// as a keychain access group (no extra entitlement). Readable only on this device and only after
/// the first unlock since boot; removed on sign-out / account switch (QuickArmazem.limpar).
enum QuickCofre {
    private static let servico = "app.vant.vendas.quick.credencial"
    private static func base() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: servico,
         kSecAttrAccount as String: "dispositivo",
         kSecAttrAccessGroup as String: QuickArmazem.grupo]
    }

    static func guardar(_ token: String) -> Bool {
        apagar()
        var q = base()
        q[kSecValueData as String] = Data(token.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }

    static func ler() -> String? {
        var q = base()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var saida: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &saida) == errSecSuccess, let dados = saida as? Data else { return nil }
        return String(data: dados, encoding: .utf8)
    }

    @discardableResult static func apagar() -> Bool {
        let r = SecItemDelete(base() as CFDictionary)
        return r == errSecSuccess || r == errSecItemNotFound
    }
}
