import Capacitor
import UIKit

/// The app's web view controller. Same as Capacitor's, plus:
/// - VANT Quick's plugin, which lives in the app target because its types are shared with the
///   widget extension;
/// - the iOS edge swipe "back" gesture.
///
/// It is created by SceneDelegate (the window's root), NOT by Main.storyboard: with scenes, the
/// storyboard is not what builds the window here. Until 28/11/2026 SceneDelegate created a plain
/// CAPBridgeViewController, so this class never ran and every VANT Quick call failed (builds 29/30).
/// A unit test (src/test/ios-cena.test.ts) keeps SceneDelegate pointing here.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VantQuickPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        // Swipe from the left edge = the same as the app's back button: the SPA's routes are in the
        // web view's history (react-router pushState), so WebKit animates back to the previous page.
        // On the first page there is nothing to go back to and the gesture does nothing.
        webView?.allowsBackForwardNavigationGestures = true
    }
}
