import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private static let processPool = WKProcessPool()
    private var webViewConfiguration: WKWebViewConfiguration?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize WebKit configuration early
        let configuration = WKWebViewConfiguration()
        configuration.processPool = AppDelegate.processPool
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.applicationNameForUserAgent = "Archivo-iOS"

        // Set up preferences
        let preferences = WKPreferences()
        preferences.javaScriptEnabled = true
        configuration.preferences = preferences

        // Store configuration for later use
        self.webViewConfiguration = configuration

        // Create window
        window = UIWindow(frame: UIScreen.main.bounds)

        // Create and configure the bridge view controller
        let viewController = CAPBridgeViewController(configuration: configuration)

        // Additional WebKit customization if needed
        if let webView = viewController.webView {
            webView.allowsBackForwardNavigationGestures = true
            webView.scrollView.bounces = true
            webView.scrollView.alwaysBounceVertical = true

            // Configure text input handling
            let contentController = WKUserContentController()
            webView.configuration.userContentController = contentController
        }

        // Set as root view controller
        window?.rootViewController = viewController
        window?.makeKeyAndVisible()

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Called when the app is about to move from active to inactive state
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Called when the app enters background
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called when app returns to foreground
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Called when app becomes active
        NotificationCenter.default.post(name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when app will terminate
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}