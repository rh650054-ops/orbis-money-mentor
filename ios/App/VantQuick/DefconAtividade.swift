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

/// Lock screen, as in Rick's mockup (28/11/2026): day revenue and block countdown, goal progress,
/// "Faltam", the approach and quick sale buttons, and sales · approaches · conversion.
struct TelaBloqueada: View {
    let s: QuickAtributos.ContentState
    private var progressoDia: Double { s.metaDia > 0 ? min(1, s.faturamentoDia / s.metaDia) : 0 }
    private var conversao: String { s.abordagensDia > 0 ? Estilo.porcento(Double(s.vendasDia) / Double(s.abordagensDia)) : "—" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("VANT QUICK").font(.system(size: 13, weight: .black)).foregroundStyle(Estilo.ouro)
                Spacer()
                Text(s.pausado ? "DEFCON EM PAUSA" : "DEFCON ATIVO").font(.system(size: 11, weight: .bold)).foregroundStyle(s.pausado ? Estilo.apagado : Estilo.ouro)
            }
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Faturamento").font(.system(size: 11, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Text(Estilo.reais(s.faturamentoDia)).font(.system(size: 26, weight: .black, design: .rounded)).foregroundStyle(Estilo.texto)
                        .minimumScaleFactor(0.6).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("Tempo restante").font(.system(size: 11, weight: .semibold)).foregroundStyle(Estilo.apagado)
                    Cronometro(s: s, tamanho: 24).foregroundStyle(Estilo.ouro)
                }
            }
            BarraOuro(valor: progressoDia, altura: 6)
            Text(s.metaDia > s.faturamentoDia ? "Faltam \(Estilo.reais(s.metaDia - s.faturamentoDia)) para a meta" : "Meta do dia batida ✓")
                .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Estilo.apagado)
            if s.interativo {
                HStack(spacing: 8) {
                    Button(intent: RegistrarAbordagemIntent(origem: "atividade")) {
                        Label("+ Abordagem", systemImage: "person.badge.plus").font(.system(size: 14, weight: .black))
                            .foregroundStyle(Estilo.texto).frame(maxWidth: .infinity, minHeight: 40)
                            .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain)
                    Button(intent: RegistrarVendaIntent(origem: "atividade")) {
                        Text(s.rapidaValor.map { "+ \(Estilo.reais($0)) Venda" } ?? "Definir valor")
                            .font(.system(size: 14, weight: .black)).foregroundStyle(Color(red: 26 / 255, green: 18 / 255, blue: 0))
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .background(Estilo.ouro, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).disabled(s.rapidaValor == nil)
                }
            }
            Text(s.aviso ?? "\(s.vendasDia) \(s.vendasDia == 1 ? "venda" : "vendas") · \(s.abordagensDia) \(s.abordagensDia == 1 ? "abordagem" : "abordagens") · \(conversao) conversão")
                .font(.system(size: 11.5, weight: .semibold)).foregroundStyle(s.aviso == nil ? Estilo.apagado : (s.avisoOk ? Estilo.verde : Estilo.coral))
                .frame(maxWidth: .infinity).lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(14)
    }
}
