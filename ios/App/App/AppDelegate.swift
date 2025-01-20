import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    let processPool = WKProcessPool()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure WebKit with shared process pool
        let config = WKWebViewConfiguration()
        config.processPool = processPool
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.preferences.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        config.preferences.javaScriptEnabled = true

        // Only set allowsContentJavaScript for iOS 14 and above
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        }

        // Enable WebKit Networking
        config.setValue(true, forKey: "_allowsDirectories")
        config.setValue(Bundle.main.bundleIdentifier, forKey: "_networkingBundleIdentifier")

        // Set the configuration for Capacitor's web view
        if let bridge = CAPBridge.bridge {
            bridge.webViewConfiguration = config

            // Configure additional web view settings
            if let webView = bridge.webView {
                webView.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
                webView.configuration.preferences.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
                webView.configuration.preferences.javaScriptEnabled = true

                if #available(iOS 14.0, *) {
                    webView.configuration.defaultWebpagePreferences.allowsContentJavaScript = true
                }

                // Allow file access from the app's container directory
                if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.archivo.app") {
                    webView.configuration.setURLSchemeHandler(nil as WKURLSchemeHandler?, forURLScheme: "capacitor-file")
                    webView.configuration.setValue(true, forKey: "allowingReadAccessToURL")
                }

                // Configure WebKit networking process
                webView.configuration.setValue(Bundle.main.bundleIdentifier, forKey: "_networkingBundleIdentifier")
                webView.configuration.processPool = processPool
            }
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}