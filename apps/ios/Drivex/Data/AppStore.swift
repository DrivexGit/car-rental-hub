import Foundation
import Observation
import Supabase

/// Everything the signed-in customer sees, loaded the same way as the site's store (apps/customer/src/lib/store.tsx):
/// the same tables, columns and filters, so the app and the site always show the same thing.
@MainActor
@Observable
final class AppStore {
    private(set) var ready = false
    private(set) var user: User?
    private(set) var fleet: [Car] = []
    private(set) var bookings: [Booking] = []
    private(set) var invoices: [Invoice] = []
    private(set) var fines: [Fine] = []
    private(set) var offers: [Offer] = []
    private(set) var documents: [Doc] = []
    private(set) var specs: [String: Specs] = [:]
    private(set) var notes: [Note] = []
    private(set) var seller: Seller?
    /// The last load failed (no connection): the screens keep the previous data and say so.
    private(set) var offline = false

    @ObservationIgnored private var authTask: Task<Void, Never>?
    @ObservationIgnored private var liveTask: Task<Void, Never>?
    @ObservationIgnored private var channel: RealtimeChannelV2?
    @ObservationIgnored private var liveFor: String?

    var unreadCount: Int { notes.filter { !$0.read }.count }
    func car(_ id: String) -> Car? { fleet.first { $0.id == id } }
    var missingDocuments: [RequiredDocuments.Item] { RequiredDocuments.missing(documents) }

    /// Loads once, then follows sign-in and sign-out.
    func start() {
        guard authTask == nil else { return }
        authTask = Task { [weak self] in
            for await (event, _) in supabase.auth.authStateChanges {
                guard let self else { return }
                if [.initialSession, .signedIn, .signedOut].contains(event) { await self.refresh() }
            }
        }
    }

    func refresh() async {
        do {
            if let out = try await loadAll() { apply(out) } else { clear() }
            offline = false
        } catch {
            // keep what is on screen; a signed-out session is handled by the auth events
            offline = true
            if user == nil, supabase.auth.currentSession == nil { clear() }
        }
        ready = true
        await followNotifications()
    }

    private func clear() {
        user = nil; fleet = []; bookings = []; invoices = []; fines = []; offers = []; documents = []; specs = [:]; notes = []; seller = nil
    }

    // MARK: loading

    private struct Loaded {
        var user: User; var fleet: [Car]; var bookings: [Booking]; var invoices: [Invoice]; var fines: [Fine]
        var offers: [Offer]; var documents: [Doc]; var specs: [String: Specs]; var notes: [Note]; var seller: Seller?
    }

    private func apply(_ d: Loaded) {
        user = d.user; fleet = d.fleet; bookings = d.bookings; invoices = d.invoices; fines = d.fines
        offers = d.offers; documents = d.documents; specs = d.specs; notes = d.notes; seller = d.seller
    }

    private nonisolated func rows(_ q: PostgrestBuilder) async throws -> [JSON] { try await q.execute().value }

    private func loadAll() async throws -> Loaded? {
        var current = supabase.auth.currentSession
        if current == nil { current = try? await supabase.auth.session }
        guard let session = current else { return nil }
        let uid = session.user.id.uuidString.lowercased()
        let db = supabase

        async let c = rows(db.from("customers").select().eq("id", value: uid).limit(1))
        async let v = rows(db.from("vehicles").select("id,make,model,year,categories,daily_price,weekly_price,monthly_price").neq("status", value: "unavailable"))
        async let r = rows(db.from("reservations").select("id,status,start_datetime,end_datetime,rental_period,extras,total_amount,vehicles(id,make,model,year,categories,plate_number,daily_price,weekly_price,monthly_price)").eq("customer_id", value: uid).order("start_datetime", ascending: false))
        // invoices folded into a monthly one are shown through that one
        async let i = rows(db.from("invoices").select("*, invoice_items(description,amount,discount,vat_rate,sort), payments(amount,provider,category,created_at,status)").filter("consolidated_into", operator: "is", value: "null").order("issued_at", ascending: false))
        async let f = rows(db.from("fines").select().order("occurred_at", ascending: false))
        async let o = rows(db.from("offers").select().order("sort_order"))
        async let d = rows(db.from("customer_documents").select("id,document_type,file_name,verification_status,created_at").order("created_at", ascending: false))
        async let sp = rows(db.from("vehicle_model_specs").select())
        async let nt = rows(db.from("notifications").select().eq("audience", value: "customer").order("created_at", ascending: false).limit(50))

        guard let me = try await c.first else { return nil } // a staff account or a half-created customer
        // the seller's TRN and bank details, so the invoice in the app matches the one the panel prints
        let tenant = me["tenant_id"].string ?? ""
        let sellerRow = try? await rows(db.from("tenants").select("trn,legal_address,bank_account_name,bank_name,iban,bic").eq("id", value: tenant).limit(1)).first

        var specs: [String: Specs] = [:]
        for x in try await sp {
            specs[Catalog.slug(x["make"].string ?? "", x["model"].string ?? "")] = Specs(
                engine: x["engine"].text, transmission: x["transmission"].string ?? "", fuel: x["fuel"].string ?? "",
                seats: x["seats"].int ?? 5, doors: x["doors"].int ?? 4, bags: x["bags"].int ?? 2,
                features: x["features"].array.compactMap(\.string), image: x["image_url"].text, gallery: x["gallery"].array.compactMap(\.string))
        }
        // Photos managed in the panel ("Car photos") win over the bundled /cars/ images.
        let fleet = Catalog.fleet(try await v).map { car -> Car in
            guard let s = specs[car.id] else { return car }
            var c = car
            c.seats = s.seats
            c.image = s.image ?? c.image
            return c
        }

        let bookings: [Booking] = try await r.map { x in
            let veh = x["vehicles"]
            let vid = veh["id"].string ?? ""
            let car = fleet.first { $0.vehicleIds.contains(vid) } ?? Catalog.fleet([veh]).first ?? Car(
                id: vid, make: veh["make"].string ?? "", model: veh["model"].string ?? "", year: veh["year"].int ?? 0,
                category: veh["categories"].array.first?.string ?? "Car", daily: 0, weekly: 0, monthly: 0,
                image: Catalog.carImage(veh["make"].string ?? "", veh["model"].string ?? ""), seats: 5, vehicleIds: [vid])
            let start = x["start_datetime"].string ?? "", end = x["end_datetime"].string ?? ""
            let raw = x["status"].string ?? ""
            return Booking(
                id: x["id"].string ?? "", car: car, plate: veh["plate_number"].string ?? "",
                period: Period(rawValue: x["rental_period"].text ?? "daily") ?? .daily,
                pickup: start, dropoff: end, total: x["total_amount"].double ?? 0,
                extras: x["extras"].array.compactMap(\.string), status: Self.status(raw, start, end), rawStatus: raw)
        }

        let invoices: [Invoice] = try await i.map { x in
            let lines = x["invoice_items"].array
                .sorted { ($0["sort"].double ?? 0) < ($1["sort"].double ?? 0) }
                .map { l in InvoiceLine(description: l["description"].string ?? "", amount: l["amount"].double ?? 0, discount: l["discount"].double ?? 0, vatRate: l["vat_rate"].double ?? 0) }
            let payments = x["payments"].array.filter { $0["status"].string == "succeeded" }.map { p in
                InvoicePayment(date: p["created_at"].string ?? "", method: Self.method(p["provider"].string), category: p["category"].text, amount: p["amount"].double ?? 0)
            }
            return Invoice(
                id: x["id"].string ?? "", number: x["number"].string ?? "", bookingId: x["reservation_id"].text,
                amount: x["amount"].double ?? 0, issued: x["issued_at"].string ?? "",
                status: Invoice.Status(rawValue: x["status"].string ?? "") ?? .pending,
                paidAt: x["paid_at"].text, description: x["description"].text, dueDate: x["due_date"].text,
                lines: lines, payments: payments, filePath: x["file_path"].text)
        }

        let byTitle = { (title: String) in fleet.first { "\($0.make) \($0.model)".lowercased() == title.lowercased() } }
        let offers: [Offer] = try await o.compactMap { x in
            let kind = Offer.Kind(rawValue: x["kind"].string ?? "") ?? .partner
            let title = x["title"].string ?? ""
            let car = kind == .car ? byTitle(title) : nil
            if kind == .car && car == nil { return nil }
            return Offer(
                id: x["id"].string ?? "", kind: kind, title: title, subtitle: x["subtitle"].text, off: x["discount_pct"].int ?? 0,
                image: x["image_url"].text, car: car, description: x["description"].text, terms: x["terms"].text, location: x["location"].text)
        }

        let user = User(
            id: uid, phone: me["phone"].string ?? "", name: me["full_name"].string ?? "", email: me["email"].text,
            customerNo: me["customer_no"].int, nationality: me["nationality"].text, avatarURL: me["avatar_url"].text,
            notify: .init(bookings: me["notify_bookings"].bool ?? true, invoices: me["notify_invoices"].bool ?? true, offers: me["notify_offers"].bool ?? true))

        return Loaded(
            user: user, fleet: fleet, bookings: bookings, invoices: invoices,
            fines: try await f.map { x in
                Fine(id: x["id"].string ?? "", bookingId: x["reservation_id"].text, type: x["type"].string ?? "", title: x["title"].text,
                     amount: x["amount"].double ?? 0, date: x["occurred_at"].string ?? "", place: x["location"].string ?? "")
            },
            offers: offers,
            documents: try await d.map { x in
                Doc(id: x["id"].string ?? "", type: x["document_type"].string ?? "", fileName: x["file_name"].string ?? "",
                    status: x["verification_status"].string ?? "", created: x["created_at"].string ?? "")
            },
            specs: specs,
            notes: try await nt.map { x in
                Note(id: x["id"].string ?? "", type: x["type"].string ?? "", title: x["title"].string ?? "", body: x["body"].text,
                     link: x["link"].text, read: !x["read_at"].isNull, created: x["created_at"].string ?? "")
            },
            seller: sellerRow.map { s in
                Seller(trn: s["trn"].text, legalAddress: s["legal_address"].text, bankAccountName: s["bank_account_name"].text,
                       bankName: s["bank_name"].text, iban: s["iban"].text, bic: s["bic"].text)
            })
    }

    private static func status(_ raw: String, _ start: String, _ end: String) -> BookingStatus {
        if raw == "pending" || raw == "draft" { return .pending }
        if raw == "completed" { return .completed }
        if raw == "cancelled" { return .cancelled }
        let now = Date()
        if now < Fmt.date(start) { return .upcoming }
        return now <= Fmt.date(end) ? .ongoing : .overdue
    }

    private static func method(_ provider: String?) -> String {
        switch provider {
        case "stripe": "Card (Stripe)"
        case "ziina": "Card (Ziina)"
        case "manual": "Cash / bank transfer"
        default: "Test payment"
        }
    }

    // MARK: live updates

    /// A new invoice, fine or booking notification reloads the data, as on the site.
    private func followNotifications() async {
        let id = user?.id
        guard id != liveFor else { return }
        liveFor = id
        liveTask?.cancel(); liveTask = nil
        if let channel { await supabase.removeChannel(channel); self.channel = nil }
        guard let id else { return }
        let ch = supabase.channel("me")
        let inserts = ch.postgresChange(InsertAction.self, schema: "public", table: "notifications", filter: "customer_id=eq.\(id)")
        channel = ch
        try? await ch.subscribeWithError()
        liveTask = Task { [weak self] in
            for await _ in inserts { await self?.refresh() }
        }
    }

    // MARK: actions

    func signOut() async {
        try? await supabase.auth.signOut()
        clear()
    }

    func markNotesRead() async {
        guard notes.contains(where: { !$0.read }) else { return }
        struct Patch: Encodable { let read_at: String }
        _ = try? await supabase.from("notifications").update(Patch(read_at: ISO8601DateFormatter().string(from: Date())))
            .eq("audience", value: "customer").filter("read_at", operator: "is", value: "null").execute()
        notes = notes.map { var n = $0; n.read = true; return n }
    }

    func updateUser(name: String? = nil, email: String? = nil, notify: User.Notify? = nil) async throws {
        guard let user else { return }
        struct Patch: Encodable {
            var full_name: String?; var email: String?
            var notify_bookings: Bool?; var notify_invoices: Bool?; var notify_offers: Bool?
        }
        let patch = Patch(full_name: name, email: email, notify_bookings: notify?.bookings, notify_invoices: notify?.invoices, notify_offers: notify?.offers)
        do { try await supabase.from("customers").update(patch).eq("id", value: user.id).execute() }
        catch { throw AppError(error.localizedDescription) }
        await refresh()
    }

    /// One file per customer (avatars/<id>/avatar.jpg); the stored URL carries a version so caches refresh.
    func setAvatar(_ jpeg: Data?) async throws {
        guard let uid = user?.id else { return }
        struct Patch: Encodable {
            let avatar_url: String?
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(avatar_url, forKey: .avatar_url) // null removes the photo
            }
            enum CodingKeys: String, CodingKey { case avatar_url }
        }
        let bucket = supabase.storage.from("avatars")
        if let jpeg {
            let path = "\(uid)/avatar.jpg"
            do { _ = try await bucket.upload(path, data: jpeg, options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: true)) }
            catch { throw AppError(t("Could not upload your photo. Please try again.")) }
            let url = try bucket.getPublicURL(path: path).absoluteString + "?v=\(Int(Date().timeIntervalSince1970 * 1000))"
            do { try await supabase.from("customers").update(Patch(avatar_url: url)).eq("id", value: uid).execute() }
            catch { throw AppError(t("Could not save your photo. Please try again.")) }
            _ = try? await bucket.remove(paths: ["\(uid)/avatar.webp"]) // left over from the site
        } else {
            do { try await supabase.from("customers").update(Patch(avatar_url: nil)).eq("id", value: uid).execute() }
            catch { throw AppError(error.localizedDescription) }
            _ = try? await bucket.remove(paths: ["\(uid)/avatar.webp", "\(uid)/avatar.jpg"])
        }
        await refresh()
    }

    enum PayStart { case checkout(URL), paid }

    /// Starts paying an invoice: a Stripe Checkout page to open, or (test setups only) paid at once.
    /// `returnPath` is the site page Stripe sends the customer back to; the app catches it (see PaymentView).
    func payInvoice(_ id: String, returnPath: String) async throws -> PayStart {
        let out = try await API.post("pay", ["invoiceId": id, "returnUrl": AppConfig.siteURL.absoluteString + returnPath])
        if let s = out["url"].text, let url = URL(string: s) { return .checkout(url) }
        await refresh()
        return .paid
    }

    /// Back from the Stripe page: confirms the payment with the provider, then reloads.
    func confirmPayment(_ paymentId: String) async -> Bool {
        let out = try? await API.post("pay", ["action": "confirm", "paymentId": paymentId])
        await refresh()
        return out?["paid"].bool ?? false
    }

    func extend(_ bookingId: String, days: Int) async throws {
        _ = try await API.post("extend", ["reservationId": bookingId, "days": days])
        await refresh()
    }
}
