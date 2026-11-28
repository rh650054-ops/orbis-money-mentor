import SwiftUI
import WidgetKit

/// Home screen: today's DEFCON at a glance (revenue, goal, left to go, progress, conversion).
/// The numbers are the ones the app wrote (QuickArmazem); the widget never fetches anything.
struct PainelEntrada: TimelineEntry {
    let date: Date
    let conta: String?
    let painel: QuickArmazem.Painel?
}

struct PainelProvedor: TimelineProvider {
    func placeholder(in context: Context) -> PainelEntrada {
        PainelEntrada(date: Date(), conta: "x", painel: .init(conta: "x", data: Estilo.hojeNoBrasil(), faturamento: 186.5, meta: 300, restante: 113.5,
                                                             progresso: 0.62, vendas: 14, abordagens: 41, conversao: 0.34, atualizadoEm: Date().timeIntervalSince1970 * 1000))
    }
    func getSnapshot(in context: Context, completion: @escaping (PainelEntrada) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : agora())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PainelEntrada>) -> Void) {
        // the app reloads it when the numbers change; this is only the fallback (day change, staleness).
        // Interactive: ask the server first (display only, short timeout), so a sale made on the lock
        // screen or another device also shows here.
        guard QuickArmazem.interativo, let conta = QuickArmazem.conta else {
            return completion(Timeline(entries: [agora()], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
        Task {
            if #available(iOS 17.0, *) { await QuickAcao.resolverDuvida() }
            if case .confirmada(let p) = await QuickServidor.enviar(acao: "painel", id: nil, origem: "widget"), let p, QuickArmazem.conta == conta {
                QuickArmazem.painelServidor = .init(conta: conta, quando: Date().timeIntervalSince1970 * 1000, painel: p)
            }
            completion(Timeline(entries: [agora()], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }
    private func agora() -> PainelEntrada {
        let conta = QuickArmazem.conta
        // interactive: the SERVER's numbers (source of the totals); otherwise what the app wrote
        let p = QuickArmazem.interativo ? (QuickArmazem.painelServidor.flatMap { $0.conta == conta ? daServidor($0) : nil } ?? QuickArmazem.painel) : QuickArmazem.painel
        let painel = p?.conta == conta ? p : nil
        // what the widget saw, for the check in Minha Conta (no sensitive data: account id and a date)
        QuickArmazem.leitura = .init(quando: Date().timeIntervalSince1970 * 1000, viuConta: conta, painelData: painel?.data)
        return PainelEntrada(date: Date(), conta: conta, painel: painel)
    }
}

/// The server's panel in the widget's own shape (no DEFCON today = nil).
private func daServidor(_ ps: QuickArmazem.PainelDoServidor) -> QuickArmazem.Painel? {
    let p = ps.painel
    guard p.sessao != nil, let fat = p.faturamento, let meta = p.meta else { return nil }
    return .init(conta: ps.conta, data: Estilo.hojeNoBrasil(Date(timeIntervalSince1970: ps.quando / 1000)), faturamento: fat, meta: meta,
                 restante: p.restante ?? max(0, meta - fat), progresso: p.progresso ?? 0, vendas: p.vendas ?? 0,
                 abordagens: p.abordagens ?? 0, conversao: p.conversao, atualizadoEm: ps.quando)
}

struct PainelVista: View {
    @Environment(\.widgetFamily) private var familia
    let e: PainelEntrada

    var body: some View {
        Group {
            if !QuickArmazem.disponivel {
                Aviso(titulo: "VANT", texto: "Widget sem acesso aos dados da VANT. Reinstale o app.")
            } else if e.conta == nil {
                Aviso(titulo: "VANT", texto: "Abra a VANT com sua conta para ver seu dia aqui.")
            } else if let p = e.painel, p.data == Estilo.hojeNoBrasil(e.date) {
                if familia == .accessoryRectangular { travada(p) } else { cheia(p) }
            } else {
                Aviso(titulo: "Sem DEFCON hoje", texto: "Comece o DEFCON na VANT e acompanhe aqui.")
            }
        }
        .containerBackground(for: .widget) { Color.black }
    }

    private func velho(_ p: QuickArmazem.Painel) -> Bool { e.date.timeIntervalSince1970 * 1000 - p.atualizadoEm > 30 * 60_000 }

    private func cheia(_ p: QuickArmazem.Painel) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("HOJE").font(.system(size: 10, weight: .black)).tracking(1.6).foregroundStyle(Estilo.ouro)
                Spacer()
                Text(velho(p) ? "Atualizado \(Estilo.hora(p.atualizadoEm))" : Estilo.hora(p.atualizadoEm))
                    .font(.system(size: 10, weight: .semibold)).foregroundStyle(velho(p) ? Estilo.coral : Estilo.apagado)
            }
            Text(Estilo.reaisCurto(p.faturamento)).font(.system(size: familia == .systemSmall ? 26 : 32, weight: .black, design: .rounded))
                .foregroundStyle(Estilo.texto).minimumScaleFactor(0.6).lineLimit(1)
            Text("meta \(Estilo.reaisCurto(p.meta))").font(.system(size: 12, weight: .bold)).foregroundStyle(Estilo.apagado)
            BarraOuro(valor: p.progresso)
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(p.restante > 0 ? "Faltam" : "Meta batida").font(.system(size: 10, weight: .bold)).foregroundStyle(Estilo.apagado)
                    Text(p.restante > 0 ? Estilo.reaisCurto(p.restante) : "✓").font(.system(size: 15, weight: .black)).foregroundStyle(p.restante > 0 ? Estilo.texto : Estilo.verde)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Conversão").font(.system(size: 10, weight: .bold)).foregroundStyle(Estilo.apagado)
                    Text(p.conversao.map(Estilo.porcento) ?? "—").font(.system(size: 15, weight: .black)).foregroundStyle(Estilo.ouro)
                }
                if familia == .systemMedium {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("Vendas").font(.system(size: 10, weight: .bold)).foregroundStyle(Estilo.apagado)
                        Text("\(p.vendas)/\(p.abordagens)").font(.system(size: 15, weight: .black)).foregroundStyle(Estilo.texto)
                    }.padding(.leading, 10)
                }
            }
        }
    }

    private func travada(_ p: QuickArmazem.Painel) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("VANT \(Estilo.reaisCurto(p.faturamento))").font(.system(size: 15, weight: .black))
            ProgressView(value: p.progresso)
            Text(p.restante > 0 ? "Faltam \(Estilo.reaisCurto(p.restante))" : "Meta batida").font(.system(size: 11, weight: .semibold))
        }
    }
}

struct Aviso: View {
    let titulo: String, texto: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(titulo).font(.system(size: 15, weight: .black)).foregroundStyle(Estilo.ouro)
            Text(texto).font(.system(size: 12, weight: .semibold)).foregroundStyle(Estilo.apagado)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PainelWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VantPainel", provider: PainelProvedor()) { PainelVista(e: $0) }
            .configurationDisplayName("VANT — Meu dia")
            .description("Faturamento, meta, quanto falta e conversão do DEFCON de hoje.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
