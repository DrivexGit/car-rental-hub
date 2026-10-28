import Foundation
import Supabase

/// The Supabase project the site uses (same anon key, same row-level security). The session is kept in the Keychain.
let supabase = SupabaseClient(
    supabaseURL: AppConfig.supabaseURL ?? URL(string: "https://not-configured.supabase.co")!,
    supabaseKey: AppConfig.isConfigured ? AppConfig.supabaseKey : "not-configured"
)

/// A message for the customer, already translated.
struct AppError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// The site's server functions (apps/customer/api/*.ts), called with the customer's session, like `api()` in src/lib/supabase.ts.
enum API {
    static func post(_ path: String, _ body: [String: Any]) async throws -> JSON {
        var req = URLRequest(url: AppConfig.siteURL.appendingPathComponent("api").appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        if let token = try? await supabase.auth.session.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 60

        let data: Data, response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: req) }
        catch { throw AppError(t("Something went wrong. Please try again.")) }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let out = (try? JSON(data: data)) ?? .null
        if status == 429 { throw AppError(t("Too many attempts. Please wait a few minutes and try again.")) }
        guard (200..<300).contains(status) else {
            throw AppError(out["error"].text.map { t($0) } ?? t("Something went wrong. Please try again."))
        }
        return out
    }
}
