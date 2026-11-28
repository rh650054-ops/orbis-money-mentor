import AppIntents
import SwiftUI
import WidgetKit

/// VANT — DEFCON Quick (V2, Rick 28/11/2026): a pocket DEFCON 4 on the home screen.
/// Countdown, the day's revenue against the goal, sales · approaches · conversion, and the quick
/// sale buttons built by the SERVER from what the seller already uses (today's products and tiers,
/// today's values, the VANT Quick config). A tap registers in the background, without opening the
/// VANT (after unlocking), and is shown as done only when the server confirms it.
/// Small / medium / large. Same kind as the old "Venda rápida" widget: widgets already placed keep working.
struct VendaEntrada: TimelineEntry {
    let date: Date
    let conta: String?
    let ultima: QuickArmazem.Ultima?
    var interativo: Bool = false
    var dia: DiaQuick? = nil
}

/// The day as the widget draws it, from the server's panel (interactive) or the app's copy.
struct DiaQuick {
    var faturamento: Double, meta: Double, restante: Double, progresso: Double
    var vendas: Int, abordagens: Int, conversao: Double?
    var bloco: Int? = nil
    var inicio: Date? = nil, fim: Date? = nil
    var pausado = false
    var opcoes: [QuickServidor.Opcao] = []
    /// false = no DEFCON today (the server said sessao: null)
    var emOperacao = true

    private static let iso: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static func data(_ s: String?) -> Date? { s.flatMap { iso.date(from: $0) ?? ISO8601DateFormatter().date(from: $0) } }

    static func doServidor(_ p: QuickServidor.Painel) -> DiaQuick {
        var d = DiaQuick(faturamento: p.faturamento ?? 0, meta: p.meta ?? 0, restante: p.restante ?? 0, progresso: p.progresso ?? 0,
                         vendas: p.vendas ?? 0, abordagens: p.abordagens ?? 0, conversao: p.conversao)
        d.bloco = p.bloco
        d.inicio = data(p.blocoInicio); d.fim = data(p.blocoFim)
        d.pausado = (p.blocoEstado ?? "running") != "running"
        d.opcoes = p.opcoes ?? []
        d.emOperacao = p.sessao != nil
        return d
    }
    static func doApp(_ p: QuickArmazem.Painel) -> DiaQuick {
        DiaQuick(faturamento: p.faturamento, meta: p.meta, restante: p.restante, progresso: p.progresso,
                 vendas: p.vendas, abordagens: p.abordagens, conversao: p.conversao)
    }
}

struct VendaProvedor: TimelineProvider {
    func placeholder(in context: Context) -> VendaEntrada {
        var d = DiaQuick(faturamento: 150, meta: 1000, restante: 850, progresso: 0.15, vendas: 1, abordagens: 1, conversao: 1)
        d.bloco = 1; d.inicio = Date().addingTimeInterval(-11); d.fim = Date().addingTimeInterval(3589)
        d.opcoes = [.init(id: "a", valor: 20, qtd: 1, nome: nil, metodo: nil, fonte: "produto"),
                    .init(id: "b", valor: 35, qtd: 2, nome: nil, metodo: nil, fonte: "produto")]
        return VendaEntrada(date: Date(), conta: "x", ultima: nil, interativo: true, dia: d)
    }
    func getSnapshot(in context: Context, completion: @escaping (VendaEntrada) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : agora())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<VendaEntrada>) -> Void) {
        // interactive: the server's numbers first (display only, never counted), like "Meu dia"
        guard QuickArmazem.interativo, let conta = QuickArmazem.conta else { return completion(linha()) }
        Task {
            if #available(iOS 17.0, *) { await QuickAcao.resolverDuvida() }
            if case .confirmada(let p) = await QuickServidor.enviar(acao: "painel", id: nil, origem: "widget"), let p, QuickArmazem.conta == conta {
                QuickArmazem.painelServidor = .init(conta: conta, quando: Date().timeIntervalSince1970 * 1000, painel: p)
            }
            completion(linha())
        }
    }
    /// Now, and the moment the "last operation" line should fade (3 min): never a fixed message.
    private func linha() -> Timeline<VendaEntrada> {
        let e = agora()
        var entradas = [e]
        if let u = e.ultima {
            let some = Date(timeIntervalSince1970: u.quando / 1000).addingTimeInterval(180)
            if some > e.date { entradas.append(VendaEntrada(date: some, conta: e.conta, ultima: nil, interativo: e.interativo, dia: e.dia)) }
        }
        return Timeline(entries: entradas, policy: .after(Date().addingTimeInterval(15 * 60)))
    }
    private func agora() -> VendaEntrada {
        let conta = QuickArmazem.conta, hoje = Estilo.hojeNoBrasil()
        let ultima = QuickArmazem.ultima.flatMap { Date().timeIntervalSince1970 * 1000 - $0.quando < 180_000 ? $0 : nil }
        var dia: DiaQuick?
        if QuickArmazem.interativo, let ps = QuickArmazem.painelServidor, ps.conta == conta, (ps.painel.data == nil || ps.painel.data == hoje) {
            dia = .doServidor(ps.painel)
        } else if let p = QuickArmazem.painel, p.conta == conta, p.data == hoje {
            dia = .doApp(p)
        }
        return VendaEntrada(date: Date(), conta: conta, ultima: ultima, interativo: QuickArmazem.interativo, dia: dia)
    }
}

struct VendaVista: View {
    @Environment(\.widgetFamily) private var familia
    let e: VendaEntrada

    var body: some View {
        Group {
            if !QuickArmazem.disponivel {
                Aviso(titulo: "DEFCON Quick", texto: "Widget sem acesso aos dados da VANT. Reinstale o app.")
            } else if e.conta == nil {
                Aviso(titulo: "DEFCON Quick", texto: "Entre na VANT para acompanhar o DEFCON aqui.")
            } else if let d = e.dia, d.emOperacao {
                switch familia {
                case .systemLarge: Grande(d: d, e: e)
                case .systemMedium: Medio(d: d, e: e)
                default: Pequeno(d: d, e: e)
                }
            } else {
                SemDefcon(d: e.dia)
            }
        }
        .containerBackground(for: .widget) { Color.black }
    }
}

// MARK: - pieces shared by the three sizes

private let tintaBotao = Color(red: 26 / 255, green: 18 / 255, blue: 0)
private let grafite = Color(red: 30 / 255, green: 30 / 255, blue: 30 / 255)

/// "⚡ DEFCON 4" and the operation state.
private struct Cabecalho: View {
    let d: DiaQuick
    var compacto = false
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "bolt.fill").font(.system(size: compacto ? 10 : 12, weight: .black))
            Text("DEFCON 4").font(.system(size: compacto ? 11 : 13, weight: .black))
            Spacer(minLength: 4)
            if !compacto {
                Text(d.pausado ? "● EM PAUSA" : "● EM OPERAÇÃO").font(.system(size: 10, weight: .bold))
                    .foregroundStyle(d.pausado ? Estilo.apagado : Estilo.verde)
            }
        }
        .foregroundStyle(Estilo.ouro)
    }
}

/// The block countdown (runs by itself, no reload), or PAUSA. WidgetKit draws a live timer as one
/// text: its digits and its ":" cannot have different colours (the separator stays white).
private struct Relogio: View {
    let d: DiaQuick
    let tamanho: CGFloat
    var body: some View {
        if d.pausado {
            Text("PAUSA").font(.system(size: tamanho * 0.7, weight: .black, design: .rounded)).foregroundStyle(Estilo.apagado)
        } else if let i = d.inicio, let f = d.fim {
            Text(timerInterval: i...max(i, f), countsDown: true)
                .font(.system(size: tamanho, weight: .heavy, design: .rounded)).monospacedDigit()
                .foregroundStyle(Color.white).multilineTextAlignment(.center)
        } else {
            Text("--:--").font(.system(size: tamanho, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.apagado)
        }
    }
}

private struct Faltam: View {
    let d: DiaQuick
    var tamanho: CGFloat = 11.5
    var body: some View {
        Group {
            if d.restante > 0.004 {
                (Text("Faltam ") + Text(Estilo.reais(d.restante)).foregroundColor(Estilo.ouro) + Text(" para a meta"))
            } else {
                Text("Meta do dia batida ✓").foregroundColor(Estilo.verde)
            }
        }
        .font(.system(size: tamanho, weight: .semibold)).foregroundStyle(Estilo.texto)
        .lineLimit(1).minimumScaleFactor(0.7)
    }
}

private func conversao(_ d: DiaQuick) -> String { d.conversao.map(Estilo.porcento) ?? "—" }

/// A gold quick sale button: what it charges is the server's option, drawn with its price.
private struct BotaoVenda: View {
    let o: QuickServidor.Opcao
    let origem: String
    var alto: CGFloat = 58
    var apagado = false
    var body: some View {
        Button(intent: RegistrarVendaIntent(origem: origem, opcao: o.id, valor: o.valor)) {
            VStack(spacing: 2) {
                Text(o.rotulo.uppercased()).font(.system(size: 9.5, weight: .bold)).tracking(0.6).opacity(0.75)
                Text("+ \(Estilo.reaisCurto(o.valor))").font(.system(size: alto >= 48 ? 20 : 16, weight: .heavy, design: .rounded))
                    .minimumScaleFactor(0.6).lineLimit(1)
            }
            .foregroundStyle(tintaBotao)
            .frame(maxWidth: .infinity, minHeight: alto, maxHeight: alto)
            .background(LinearGradient(colors: [Estilo.ouroClaro, Estilo.ouro], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 14))
            .opacity(apagado ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Registrar venda de \(Estilo.reais(o.valor)), \(o.rotulo)")
    }
}

private struct BotaoAbordagem: View {
    let origem: String
    var alto: CGFloat = 42
    var body: some View {
        Button(intent: RegistrarAbordagemIntent(origem: origem)) {
            Label("+ Abordagem", systemImage: "person.badge.plus").font(.system(size: alto > 36 ? 14 : 12, weight: .bold))
                .foregroundStyle(Estilo.texto)
                .frame(maxWidth: .infinity, minHeight: alto, maxHeight: alto)
                .background(grafite, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.10), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Registrar abordagem")
    }
}

/// When there is no option at all (no product today, no sale yet, no config): what to do, not a code.
private struct SemOpcao: View {
    var alto: CGFloat = 58
    var body: some View {
        Text("Faça a 1ª venda no DEFCON\npara criar o botão").font(.system(size: 11, weight: .semibold)).multilineTextAlignment(.center)
            .foregroundStyle(Estilo.apagado)
            .frame(maxWidth: .infinity, minHeight: alto, maxHeight: alto)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Estilo.ouro.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    }
}

/// The discreet "last operation" line (fades after 3 minutes; empty space otherwise).
private struct UltimaOperacao: View {
    let u: QuickArmazem.Ultima?
    var body: some View {
        Group {
            if let u {
                switch u.estado {
                case "registrando": Label("Registrando…", systemImage: "clock").foregroundStyle(Estilo.apagado)
                case "confirmada": Label(u.texto ?? "Confirmada", systemImage: "checkmark.circle").foregroundStyle(Estilo.verde)
                default: Label(u.texto ?? "Não registrada", systemImage: "exclamationmark.circle").foregroundStyle(Estilo.coral)
                }
            } else {
                Text(" ")
            }
        }
        .font(.system(size: 10.5, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
    }
}

// MARK: - large: the mini DEFCON 4 of Rick's mockup

private struct Grande: View {
    let d: DiaQuick
    let e: VendaEntrada
    // iOS gives the large widget about 306 × 322 pt inside its margins: heights below add up to ~312
    var body: some View {
        VStack(spacing: 4) {
            Cabecalho(d: d)
            VStack(spacing: 0) {
                Text("BLOCO \(String(format: "%02d", d.bloco ?? 1)) · TEMPO RESTANTE").font(.system(size: 10, weight: .semibold)).tracking(0.4)
                    .foregroundStyle(Estilo.apagado)
                Relogio(d: d, tamanho: 38)
            }
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Faturamento do dia").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Text(Estilo.reais(d.faturamento)).font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.verde)
                        .minimumScaleFactor(0.6).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Meta diária").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Text(Estilo.reaisCurto(d.meta)).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.texto)
                }
            }
            BarraOuro(valor: d.progresso, altura: 6)
            Faltam(d: d)
            Divider().overlay(Color.white.opacity(0.08))
            HStack {
                numero("VENDAS", "\(d.vendas)")
                numero("ABORD.", "\(d.abordagens)")
                numero("CONVERSÃO", conversao(d), cor: Estilo.ouro)
            }
            if e.interativo {
                Divider().overlay(Color.white.opacity(0.08))
                Text("VENDA RÁPIDA").font(.system(size: 9.5, weight: .bold)).tracking(2.5).foregroundStyle(Estilo.apagado)
                HStack(spacing: 8) {
                    if d.opcoes.isEmpty { SemOpcao(alto: 50) }
                    ForEach(d.opcoes.prefix(2), id: \.id) { BotaoVenda(o: $0, origem: "widget", alto: 50, apagado: d.pausado) }
                }
                BotaoAbordagem(origem: "widget", alto: 36)
                UltimaOperacao(u: e.ultima)
            }
        }
    }
    private func numero(_ rotulo: String, _ valor: String, cor: Color = Estilo.texto) -> some View {
        VStack(spacing: 2) {
            Text(rotulo).font(.system(size: 9.5, weight: .semibold)).foregroundStyle(Estilo.apagado)
            Text(valor).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundStyle(cor)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - medium: the numbers on the left, the buttons on the right

private struct Medio: View {
    let d: DiaQuick
    let e: VendaEntrada
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack { Cabecalho(d: d, compacto: true); Relogio(d: d, tamanho: 17) }
                Text(Estilo.reais(d.faturamento)).font(.system(size: 21, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.verde)
                    .minimumScaleFactor(0.6).lineLimit(1)
                BarraOuro(valor: d.progresso, altura: 5)
                Faltam(d: d, tamanho: 10.5)
                Spacer(minLength: 0)
                if e.interativo, e.ultima != nil {
                    UltimaOperacao(u: e.ultima)
                } else {
                    Text("\(d.vendas) \(d.vendas == 1 ? "venda" : "vendas") · \(d.abordagens) abord. · \(conversao(d))")
                        .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Estilo.apagado).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if e.interativo {
                VStack(spacing: 6) {
                    if d.opcoes.isEmpty { SemOpcao(alto: 72) }
                    ForEach(d.opcoes.prefix(2), id: \.id) { BotaoVenda(o: $0, origem: "widget", alto: d.opcoes.count > 1 ? 40 : 72, apagado: d.pausado) }
                    BotaoAbordagem(origem: "widget", alto: 32)
                }
                .frame(width: 138)
            }
        }
    }
}

// MARK: - small: revenue, countdown, the best option and the approach

private struct Pequeno: View {
    let d: DiaQuick
    let e: VendaEntrada
    var body: some View {
        // ~126 × 126 pt inside the margins: heights add up to ~123
        VStack(alignment: .leading, spacing: 4) {
            HStack { Cabecalho(d: d, compacto: true); Relogio(d: d, tamanho: 14) }
            Text(Estilo.reaisCurto(d.faturamento)).font(.system(size: 19, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.verde)
                .minimumScaleFactor(0.6).lineLimit(1)
            BarraOuro(valor: d.progresso, altura: 4)
            if e.interativo {
                if let o = d.opcoes.first { BotaoVenda(o: o, origem: "widget", alto: 40, apagado: d.pausado) } else { SemOpcao(alto: 40) }
                BotaoAbordagem(origem: "widget", alto: 26)
            } else {
                Faltam(d: d, tamanho: 10)
                Spacer(minLength: 0)
                Text("\(d.vendas) vendas · \(conversao(d))").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Estilo.apagado)
            }
        }
    }
}

/// No DEFCON today: the day's numbers so far, if any, and what starts it.
private struct SemDefcon: View {
    let d: DiaQuick?
    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "bolt.fill").font(.system(size: 12, weight: .black))
                Text("DEFCON 4").font(.system(size: 13, weight: .black))
                Spacer()
            }.foregroundStyle(Estilo.ouro)
            Spacer(minLength: 0)
            Text("Comece o DEFCON na VANT").font(.system(size: 14, weight: .bold)).foregroundStyle(Estilo.texto).multilineTextAlignment(.center)
            if let d, d.meta > 0 {
                Text("Meta do dia \(Estilo.reaisCurto(d.meta))").font(.system(size: 11, weight: .semibold)).foregroundStyle(Estilo.apagado)
            }
            Spacer(minLength: 0)
        }
    }
}

struct VendaRapidaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VantVendaRapida", provider: VendaProvedor()) { VendaVista(e: $0) }
            .configurationDisplayName("VANT — DEFCON Quick")
            .description("Seu DEFCON de bolso: cronômetro, faturamento, meta e venda rápida sem abrir o app.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
