import Capacitor
import UIKit

/// The app's web view controller (Main.storyboard). Same as Capacitor's, plus VANT Quick's plugin,
/// which lives in the app target because its types are shared with the widget extension.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VantQuickPlugin())
    }
}
