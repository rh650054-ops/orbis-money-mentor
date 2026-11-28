import AppIntents
import SwiftUI
import WidgetKit

/// Home screen: one tap = one quick sale (the amount configured in the app) or one approach.
/// The buttons open the VANT, which executes the tap in the running DEFCON block; the status line
/// shows "registrando" → "salva, sincronizando" → "confirmada" (or why it was refused).
struct VendaEntrada: TimelineEntry {
    let date: Date
    let conta: String?
    let config: QuickArmazem.Config?
    let ultima: QuickArmazem.Ultima?
}

struct VendaProvedor: TimelineProvider {
    func placeholder(in context: Context) -> VendaEntrada {
        VendaEntrada(date: Date(), conta: "x", config: .init(valor: 10, rotulo: "R$ 10,00"), ultima: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (VendaEntrada) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : agora())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<VendaEntrada>) -> Void) {
        completion(Timeline(entries: [agora()], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
    private func agora() -> VendaEntrada {
        VendaEntrada(date: Date(), conta: QuickArmazem.conta, config: QuickArmazem.config, ultima: QuickArmazem.ultima)
    }
}

struct VendaVista: View {
    @Environment(\.widgetFamily) private var familia
    let e: VendaEntrada

    var body: some View {
        Group {
            if !QuickArmazem.disponivel {
                Aviso(titulo: "VANT Quick", texto: "Widget sem acesso aos dados da VANT. Reinstale o app.")
            } else if e.conta == nil {
                Aviso(titulo: "VANT Quick", texto: "Abra a VANT com sua conta para vender pelo widget.")
            } else {
                VStack(spacing: 8) {
                    if familia == .systemMedium {
                        HStack(spacing: 8) { botaoVenda; botaoAbordagem }
                    } else {
                        botaoVenda; botaoAbordagem
                    }
                    status
                }
            }
        }
        .containerBackground(for: .widget) { Color.black }
    }

    private var botaoVenda: some View {
        Button(intent: RegistrarVendaIntent()) {
            VStack(spacing: 2) {
                Text("VENDA").font(.system(size: 10, weight: .black)).tracking(1.4)
                Text(e.config?.rotulo ?? "Definir valor").font(.system(size: e.config == nil ? 13 : 19, weight: .black, design: .rounded))
                    .minimumScaleFactor(0.6).lineLimit(1)
            }
            .foregroundStyle(Color(red: 26 / 255, green: 18 / 255, blue: 0))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(LinearGradient(colors: [Estilo.ouroClaro, Estilo.ouro], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(e.config.map { "Registrar venda de \($0.rotulo)" } ?? "Abrir a VANT para definir a venda rápida")
    }

    private var botaoAbordagem: some View {
        Button(intent: RegistrarAbordagemIntent()) {
            Text("ABORDAGEM").font(.system(size: 12, weight: .black)).tracking(1)
                .foregroundStyle(Estilo.ouro)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 14).stroke(Estilo.ouro.opacity(0.55), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Registrar abordagem")
    }

    @ViewBuilder private var status: some View {
        if let u = e.ultima, e.date.timeIntervalSince1970 * 1000 - u.quando < 30 * 60_000 {
            let (texto, cor) = frase(u)
            Text(texto).font(.system(size: 10.5, weight: .bold)).foregroundStyle(cor).lineLimit(1).minimumScaleFactor(0.7)
        } else {
            Text("Toque para registrar no DEFCON").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Estilo.apagado).lineLimit(1).minimumScaleFactor(0.7)
        }
    }

    private func frase(_ u: QuickArmazem.Ultima) -> (String, Color) {
        let nome = u.tipo == "abordagem" ? "Abordagem" : "Venda"
        switch u.estado {
        case "registrando": return ("Registrando \(nome.lowercased())…", Estilo.apagado)
        case "pendente_sync": return ("\(nome) salva · sincronizando", Estilo.ouro)
        case "confirmada": return ("\(nome) confirmada ✓", Estilo.verde)
        default: return (u.texto ?? "Não registrada", Estilo.coral)
        }
    }
}

struct VendaRapidaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VantVendaRapida", provider: VendaProvedor()) { VendaVista(e: $0) }
            .configurationDisplayName("VANT — Venda rápida")
            .description("Registre a venda rápida ou uma abordagem no bloco do DEFCON em andamento.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
