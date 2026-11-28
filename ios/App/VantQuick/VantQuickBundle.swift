import SwiftUI
import WidgetKit

/// VANT Quick: the widgets and the DEFCON Live Activity of the iPhone app.
@main
struct VantQuickBundle: WidgetBundle {
    var body: some Widget {
        PainelWidget()
        VendaRapidaWidget()
        DefconAtividade()
    }
}
