import StoreKit
import StoreKitTest
import XCTest
@testable import VantStorekitPlugin

/// Local StoreKit tests (Produtos.storekit: four FICTIONAL products, no App Store, no real money).
/// They run in the iOS Simulator on the macOS runner (.github/workflows/ios-testes.yml), twice:
///   - as plain package tests: the Swift compiles and the products load. StoreKit's local test
///     server refuses a PURCHASE made from a bare test process, so the purchase tests are skipped;
///   - hosted by the throwaway app in ios/Hospedeiro: every test, purchases included.
/// What they prove is the native half: what the bridge hands to the app, and that it never finishes
/// a transaction by itself. What the app and the server do with it is tested in
/// src/features/assinatura-apple and supabase/functions/apple-*.
@available(iOS 15.2, *)
final class LojaAppleTests: XCTestCase {
    private var sessao: SKTestSession!
    private let loja = LojaApple()
    private let conta = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
    private let essencial = "app.vant.vendas.essencial.mensal"
    private let proMensal = "app.vant.vendas.pro.mensal"
    private let proAnual = "app.vant.vendas.pro.anual"
    private let banco = "app.vant.vendas.banco.mensal"

    #if SWIFT_PACKAGE
    private static let recursos = Bundle.module
    #else
    private static let recursos = Bundle(for: LojaAppleTests.self)
    #endif
    /// true when a real app hosts the tests (purchases work only then)
    private static let hospedado = Bundle.main.bundleIdentifier == "app.vant.vendas.hospedeiro"

    override func setUp() async throws {
        let url = try XCTUnwrap(Self.recursos.url(forResource: "Produtos", withExtension: "storekit"))
        sessao = try SKTestSession(contentsOf: url)
        sessao.resetToDefaultState()
        sessao.clearTransactions()
        sessao.disableDialogs = true
        guard Self.hospedado else { return }
        // The local test server clears in the background: a transaction of the PREVIOUS test (an
        // approved Ask to Buy, for instance) can still be listed for a moment. Wait for a clean start.
        for _ in 0..<50 {
            if await loja.pendentes().isEmpty { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
    }

    override func tearDown() {
        sessao.clearTransactions()
        sessao = nil
    }

    private func comprar(_ produto: String, _ quem: UUID? = nil) async throws -> [String: Any] {
        try XCTSkipUnless(Self.hospedado, "a purchase needs the host app (ios/Hospedeiro)")
        return try await loja.comprar(produto, conta: quem ?? conta)
    }

    func testProdutosComPrecoDaLoja() async throws {
        let lista = try await loja.produtos([essencial, proMensal, proAnual, banco, "app.vant.vendas.nao.existe"])
        XCTAssertEqual(lista.count, 4, "the four fictional products, and nothing for an unknown id")
        let porId = Dictionary(uniqueKeysWithValues: lista.map { ($0["id"] as! String, $0) })
        XCTAssertEqual(porId[essencial]?["preco"] as? String, "29.9")
        XCTAssertEqual(porId[proMensal]?["preco"] as? String, "49.9")
        XCTAssertEqual(porId[proAnual]?["preco"] as? String, "419.9")
        XCTAssertEqual(porId[banco]?["preco"] as? String, "12.9")
        XCTAssertEqual((porId[proAnual]?["periodo"] as? [String: Any])?["unidade"] as? String, "ano")
        XCTAssertEqual((porId[proMensal]?["periodo"] as? [String: Any])?["unidade"] as? String, "mes")
        XCTAssertFalse((porId[proAnual]?["precoFormatado"] as? String ?? "").isEmpty, "the formatted price comes from StoreKit")
        XCTAssertNotEqual(porId[banco]?["grupo"] as? String, porId[proMensal]?["grupo"] as? String, "the bank add-on is in its own group")
        XCTAssertEqual(porId[essencial]?["grupo"] as? String, porId[proAnual]?["grupo"] as? String)
    }

    func testCompraDeCadaProdutoFicaSemConcluirAteOAppMandar() async throws {
        for produto in [essencial, banco] {
            let r = try await comprar(produto)
            XCTAssertEqual(r["estado"] as? String, "comprada")
            XCTAssertEqual(r["produto"] as? String, produto)
            XCTAssertEqual(r["conta"] as? String, conta.uuidString.lowercased(), "the VANT account is signed into the purchase")
            XCTAssertFalse((r["jws"] as? String ?? "").isEmpty, "the signed transaction is what goes to the server")
            let id = try XCTUnwrap(r["transacao"] as? String)

            var pendentes = await loja.pendentes()
            XCTAssertTrue(pendentes.contains { $0["transacao"] as? String == id }, "paid and NOT finished: it is still there to be recovered")

            let concluida = await loja.concluir(id)
            XCTAssertTrue(concluida)
            pendentes = await loja.pendentes()
            XCTAssertFalse(pendentes.contains { $0["transacao"] as? String == id }, "finished only when the app said so")
            let outraVez = await loja.concluir(id)
            XCTAssertFalse(outraVez, "finishing twice is harmless")
        }
        let direitos = await loja.direitos()
        XCTAssertEqual(Set(direitos.compactMap { $0["produto"] as? String }), [essencial, banco], "plan and bank add-on live side by side")
    }

    func testProMensalEProAnual() async throws {
        let mensal = try await comprar(proMensal)
        XCTAssertEqual(mensal["estado"] as? String, "comprada")
        let anual = try await comprar(proAnual)
        XCTAssertEqual(anual["estado"] as? String, "comprada")
        XCTAssertEqual(anual["original"] as? String, mensal["original"] as? String, "same group: it is the same subscription changing product")
    }

    func testRestaurarDevolveOQueAContaAppleTem() async throws {
        let r = try await comprar(proAnual)
        _ = await loja.concluir(try XCTUnwrap(r["transacao"] as? String))
        let direitos = await loja.direitos()
        let achado = try XCTUnwrap(direitos.first { $0["produto"] as? String == proAnual })
        XCTAssertEqual(achado["conta"] as? String, conta.uuidString.lowercased(), "a restored purchase still says which VANT account it was bought for")
        XCTAssertFalse((achado["jws"] as? String ?? "").isEmpty)
    }

    func testTrocaDeContaACompraContinuaDaContaQueComprou() async throws {
        let outra = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
        let r = try await comprar(essencial, outra)
        let pendentes = await loja.pendentes()
        let minha = try XCTUnwrap(pendentes.first { $0["transacao"] as? String == r["transacao"] as? String })
        XCTAssertEqual(minha["conta"] as? String, outra.uuidString.lowercased(), "whoever is logged in later, the purchase carries the account it was made for")
    }

    func testCompraPendenteNaoVemComoComprada() async throws {
        try XCTSkipUnless(Self.hospedado, "a purchase needs the host app (ios/Hospedeiro)")
        sessao.askToBuyEnabled = true
        let chegou = expectation(description: "the approved purchase arrives through the listener")
        chegou.assertForOverFulfill = false
        let escuta = loja.ouvir { dados in
            if dados["produto"] as? String == self.proMensal { chegou.fulfill() }
        }
        let r = try await comprar(proMensal)
        XCTAssertEqual(r["estado"] as? String, "pendente")
        XCTAssertNil(r["jws"], "nothing to validate yet: no access is asked for a pending purchase")
        let pendente = try XCTUnwrap(sessao.allTransactions().first { $0.pendingAskToBuyConfirmation })
        try sessao.approveAskToBuyTransaction(identifier: pendente.identifier)
        await fulfillment(of: [chegou], timeout: 20)
        escuta.cancel()
    }

    func testFalhaNaCompraViraCodigoENaoCriaTransacao() async throws {
        try XCTSkipUnless(Self.hospedado, "a purchase needs the host app (ios/Hospedeiro)")
        let antes = Set(await loja.pendentes().compactMap { $0["transacao"] as? String })
        sessao.failTransactionsEnabled = true
        sessao.failureError = .unknown
        do {
            _ = try await comprar(essencial)
            XCTFail("the purchase should have failed")
        } catch {
            XCTAssertFalse(LojaApple.codigo(error).isEmpty)
        }
        // what this purchase created, not what another test may have left behind
        let novas = await loja.pendentes().filter { !antes.contains($0["transacao"] as? String ?? "") }
        XCTAssertTrue(novas.isEmpty, "a purchase that failed left nothing to be charged or recovered: \(novas.compactMap { $0["produto"] as? String })")
    }

    func testRenovacaoChegaPeloOuvinte() async throws {
        let r = try await comprar(proMensal)
        _ = await loja.concluir(try XCTUnwrap(r["transacao"] as? String))
        let chegou = expectation(description: "the renewal arrives as a new transaction of the same subscription")
        chegou.assertForOverFulfill = false
        let escuta = loja.ouvir { dados in
            if dados["original"] as? String == r["original"] as? String, dados["transacao"] as? String != r["transacao"] as? String { chegou.fulfill() }
        }
        try sessao.forceRenewalOfSubscription(productIdentifier: proMensal)
        await fulfillment(of: [chegou], timeout: 20)
        escuta.cancel()
        let pendentes = await loja.pendentes()
        XCTAssertTrue(pendentes.contains { $0["original"] as? String == r["original"] as? String && $0["transacao"] as? String != r["transacao"] as? String },
                      "the renewal is also kept unfinished until the server confirms it")
    }

    func testReembolsoChegaComAData() async throws {
        let r = try await comprar(proAnual)
        let id = try XCTUnwrap(r["transacao"] as? String)
        _ = await loja.concluir(id)
        let chegou = expectation(description: "the refund arrives with its date")
        chegou.assertForOverFulfill = false
        let escuta = loja.ouvir { dados in
            if dados["transacao"] as? String == id, dados["revogada"] != nil { chegou.fulfill() }
        }
        try sessao.refundTransaction(identifier: try XCTUnwrap(UInt(id)))
        await fulfillment(of: [chegou], timeout: 20)
        escuta.cancel()
        let direitos = await loja.direitos()
        XCTAssertFalse(direitos.contains { $0["produto"] as? String == proAnual }, "a refunded purchase is no longer an entitlement")
    }

    func testUpgradeEDowngrade() async throws {
        let ess = try await comprar(essencial)
        _ = await loja.concluir(try XCTUnwrap(ess["transacao"] as? String))
        let pro = try await comprar(proMensal)
        XCTAssertEqual(pro["estado"] as? String, "comprada")
        XCTAssertEqual(pro["original"] as? String, ess["original"] as? String, "upgrade: the SAME subscription changes product (the server keeps one row per subscription)")
        XCTAssertNotEqual(pro["transacao"] as? String, ess["transacao"] as? String)
        _ = await loja.concluir(try XCTUnwrap(pro["transacao"] as? String))
        var direitos = await loja.direitos()
        XCTAssertTrue(direitos.contains { $0["produto"] as? String == proMensal }, "upgrade: the higher plan is valid at once")

        // downgrade asked: on the App Store it takes effect at the next renewal. What is asserted here
        // is what the bridge hands over: one more transaction of the same subscription, and the
        // account still entitled to a plan. (How long the local test server keeps the old product
        // listed is not VANT's rule: the server decides by the newest signed status.)
        let volta = try await comprar(essencial)
        XCTAssertEqual(volta["estado"] as? String, "comprada")
        XCTAssertEqual(volta["original"] as? String, ess["original"] as? String)
        direitos = await loja.direitos()
        XCTAssertFalse(direitos.isEmpty, "downgrade asked: the account keeps a valid plan")
        XCTAssertTrue(direitos.allSatisfy { $0["original"] as? String == ess["original"] as? String }, "still one subscription")
    }
}
