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

struct TelaBloqueada: View {
    let s: QuickAtributos.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("DEFCON · BLOCO \(s.bloco)/\(s.totalBlocos)").font(.system(size: 11, weight: .black)).tracking(1.2).foregroundStyle(Estilo.ouro)
                Spacer()
                Cronometro(s: s, tamanho: 24)
            }
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(Estilo.reaisCurto(s.faturamentoBloco)).font(.system(size: 30, weight: .black, design: .rounded)).foregroundStyle(Estilo.texto)
                Text("de \(Estilo.reaisCurto(s.metaHora))").font(.system(size: 13, weight: .bold)).foregroundStyle(Estilo.apagado)
                Spacer()
                Text("\(s.vendasBloco) \(s.vendasBloco == 1 ? "venda" : "vendas")").font(.system(size: 14, weight: .black)).foregroundStyle(Estilo.texto)
            }
            BarraOuro(valor: progresso(s))
        }
        .padding(16)
    }
}
