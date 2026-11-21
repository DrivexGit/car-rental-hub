import Foundation
import Observation
import Supabase
import UIKit
import UserNotifications

/// Push notifications (APNs), shown even when the app is closed. The phone's token is stored in push_subscriptions
/// (rpc register_device) and the server's push hook sends to it, next to the site's web push (api/_native-push.ts).
@MainActor
@Observable
final class Push: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Push()
    /// The page a tapped push points to ("/bookings/<id>#invoice"); RootView opens it, then clears it.
    var pendingLink: String?
    /// Kept across launches, so a sign-out right after opening the app still removes this phone's row.
    @ObservationIgnored private var token: String? {
        get { UserDefaults.standard.string(forKey: "drivex.pushToken") }
        set { UserDefaults.standard.set(newValue, forKey: "drivex.pushToken") }
    }

    /// Signed in: ask once (iOS remembers the answer), then register this phone with Apple.
    func signedIn() {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in
            guard ok else { return }
            Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    func received(token data: Data) {
        let hex = data.map { String(format: "%02x", $0) }.joined()
        token = hex
        Task {
            struct Args: Encodable { let p_token: String; let p_platform: String }
            _ = try? await supabase.rpc("register_device", params: Args(p_token: hex, p_platform: "apns")).execute()
        }
    }

    /// Before sign-out: this phone gets nothing more for that customer.
    func signingOut() async {
        guard let token else { return }
        _ = try? await supabase.from("push_subscriptions").delete().eq("endpoint", value: token).execute()
        self.token = nil
    }

    // a push while the app is open: show it as a banner too
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    // a tapped push: open its page
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let url = response.notification.request.content.userInfo["url"] as? String
        await MainActor.run { if let url, url.hasPrefix("/") { Push.shared.pendingLink = url } }
    }
}

/// Apple hands the device token to the app delegate.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // set before launch ends, so a push tapped while the app was closed is delivered to it
        UNUserNotificationCenter.current().delegate = Push.shared
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in Push.shared.received(token: deviceToken) }
    }
}
