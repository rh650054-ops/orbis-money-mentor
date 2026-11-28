import ActivityKit
import SwiftUI
import WidgetKit

/// The DEFCON Live Activity: the current block's countdown, its revenue against the goal per hour,
/// its sales, on the lock screen and in the Dynamic Island. Started, updated and ended by the app
/// with the real DEFCON session; the countdown runs by itself (no update needed every second).
struct DefconAtividade: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: QuickAtributos.self) { ctx in
            TelaBloqueada(s: ctx.state)
                .activityBackgroundTint(Color.black)
                .activitySystemActionForegroundColor(Estilo.ouro)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BLOCO \(ctx.state.bloco)").font(.system(size: 10, weight: .black)).foregroundStyle(Estilo.ouro)
                        Text(Estilo.reaisCurto(ctx.state.faturamentoBloco)).font(.system(size: 22, weight: .black, design: .rounded)).foregroundStyle(Estilo.texto)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Cronometro(s: ctx.state, tamanho: 22).frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        BarraOuro(valor: progresso(ctx.state), altura: 6)
                        HStack {
                            Text("meta/hora \(Estilo.reaisCurto(ctx.state.metaHora))")
                            Spacer()
                            Text("\(ctx.state.vendasBloco) \(ctx.state.vendasBloco == 1 ? "venda" : "vendas")")
                        }
                        .font(.system(size: 12, weight: .bold)).foregroundStyle(Estilo.apagado)
                    }
                }
            } compactLeading: {
                Text(Estilo.reaisCurto(ctx.state.faturamentoBloco)).font(.system(size: 13, weight: .black)).foregroundStyle(Estilo.ouro)
            } compactTrailing: {
                Cronometro(s: ctx.state, tamanho: 13).frame(maxWidth: 48)
            } minimal: {
                Cronometro(s: ctx.state, tamanho: 11)
            }
            .keylineTint(Estilo.ouro)
        }
    }
}

private func progresso(_ s: QuickAtributos.ContentState) -> Double {
    s.metaHora > 0 ? min(1, s.faturamentoBloco / s.metaHora) : 0
}

/// The block countdown; "Pausa" during a break.
struct Cronometro: View {
    let s: QuickAtributos.ContentState
    let tamanho: CGFloat
    var body: some View {
        if s.pausado {
            Text("Pausa").font(.system(size: tamanho, weight: .black)).foregroundStyle(Estilo.apagado)
        } else {
            Text(timerInterval: s.blocoInicio...max(s.blocoInicio, s.blocoFim), countsDown: true)
                .font(.system(size: tamanho, weight: .black, design: .rounded)).monospacedDigit()
                .foregroundStyle(Estilo.texto).multilineTextAlignment(.trailing)
        }
    }
}

/// Lock screen, V2 (Rick's mockup, 28/11/2026): "VANT QUICK | DEFCON ATIVO", the day's revenue and
/// the block countdown, goal progress, what is left, sales · approaches · conversion, and up to three
/// buttons: the server's quick sale options (at most 2) and the approach. One option: sale and
/// approach share the row. iOS caps this view at about 160 pt high, so "Faltam" and the counts share
/// one line. The last operation shows in the header for a moment, never as a fixed line.
struct TelaBloqueada: View {
    let s: QuickAtributos.ContentState
    private var progressoDia: Double { s.metaDia > 0 ? min(1, s.faturamentoDia / s.metaDia) : 0 }
    private var conversao: String { s.abordagensDia > 0 ? Estilo.porcento(Double(s.vendasDia) / Double(s.abordagensDia)) : "—" }
    private static let tinta = Color(red: 26 / 255, green: 18 / 255, blue: 0)
    /// the server's options; a build-31 state (no list yet) falls back to its single value
    private var botoes: [QuickAtributos.Botao] {
        if let b = s.botoes { return Array(b.prefix(2)) }
        return s.rapidaValor.map { [.init(id: "", valor: $0, rotulo: "Venda rápida")] } ?? []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text("VANT QUICK").font(.system(size: 12, weight: .black)).foregroundStyle(Estilo.ouro)
                Spacer()
                if let aviso = s.aviso {
                    Label(aviso, systemImage: s.avisoOk ? "checkmark.circle" : "exclamationmark.circle")
                        .font(.system(size: 10.5, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(s.avisoOk ? Estilo.verde : Estilo.coral)
                } else {
                    Text(s.pausado ? "DEFCON EM PAUSA" : "DEFCON ATIVO").font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(s.pausado ? Estilo.apagado : Estilo.ouro)
                }
            }
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Faturamento").font(.system(size: 10, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Text(Estilo.reais(s.faturamentoDia)).font(.system(size: 22, weight: .heavy, design: .rounded)).foregroundStyle(Estilo.texto)
                        .minimumScaleFactor(0.6).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("Tempo restante").font(.system(size: 10, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Cronometro(s: s, tamanho: 21)
                }
            }
            BarraOuro(valor: progressoDia, altura: 5)
            HStack(spacing: 6) {
                Group {
                    if s.metaDia > s.faturamentoDia {
                        Text("Faltam \(Estilo.reais(s.metaDia - s.faturamentoDia)) para a meta")
                    } else {
                        Text("Meta do dia batida ✓").foregroundColor(Estilo.verde)
                    }
                }
                .foregroundStyle(Estilo.texto)
                Spacer(minLength: 4)
                (Text("\(s.vendasDia) \(s.vendasDia == 1 ? "venda" : "vendas") · \(s.abordagensDia) abord. · ").foregroundColor(Estilo.apagado)
                 + Text("\(conversao) conv.").foregroundColor(Estilo.ouro))
            }
            .font(.system(size: 10.5, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            if s.interativo {
                HStack(spacing: 6) {
                    ForEach(botoes, id: \.self) { b in
                        Button(intent: RegistrarVendaIntent(origem: "atividade", opcao: b.id, valor: b.valor)) {
                            VStack(spacing: 0) {
                                Text("+ \(Estilo.reaisCurto(b.valor))").font(.system(size: 16, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                                Text(b.rotulo).font(.system(size: 9, weight: .semibold)).opacity(0.75).lineLimit(1)
                            }
                            .foregroundStyle(Self.tinta)
                            .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
                            .background(Estilo.ouro, in: RoundedRectangle(cornerRadius: 12))
                            .opacity(s.pausado ? 0.45 : 1)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Registrar venda de \(Estilo.reais(b.valor))")
                    }
                    Button(intent: RegistrarAbordagemIntent(origem: "atividade")) {
                        VStack(spacing: 1) {
                            Image(systemName: "person.badge.plus").font(.system(size: 12, weight: .bold))
                            Text("Abordagem").font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(Estilo.texto)
                        .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
                        .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Registrar abordagem")
                }
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
    }
}
