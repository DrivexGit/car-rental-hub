import SwiftUI

/// Bookings tab: every booking, most urgent first (or most recent), with a status filter.
struct BookingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var byPriority = true
    @State private var filter = "all"
    @State private var picking = false

    private static let priority: [BookingStatus: Int] = [.overdue: 0, .pending: 1, .ongoing: 2, .upcoming: 3, .completed: 4, .cancelled: 5]
    private static let filters = ["all", "pending", "overdue", "ongoing", "upcoming", "completed", "cancelled"]
    private static let labels = ["all": "All", "pending": "Awaiting payment", "overdue": "Overdue", "ongoing": "Ongoing", "upcoming": "Upcoming", "completed": "Completed", "cancelled": "Cancelled"]

    var body: some View {
        let list = store.bookings
            .filter { filter == "all" || $0.status.rawValue == filter }
            .sorted { a, b in
                let pa = byPriority ? Self.priority[a.status]! : 0, pb = byPriority ? Self.priority[b.status]! : 0
                return pa != pb ? pa < pb : a.pickup > b.pickup
            }
        PageScroll {
            TopBar()
            PageTitle(t("My bookings"))
            HStack {
                Button { Haptics.tap(); byPriority.toggle() } label: {
                    Label { Text(byPriority ? t("Priority") : t("Most recent")) + Text(" ") + Text(Image(systemName: "chevron.down")) } icon: { Image(systemName: "arrow.up.arrow.down") }
                }
                Spacer()
                Button { Haptics.tap(); picking = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "slider.horizontal.3")
                        Text(t("Filters"))
                        if filter != "all" { Circle().fill(Color.brand).frame(width: 8, height: 8) }
                    }
                }
            }
            .font(.dx(14, .medium)).foregroundStyle(Color.ink).buttonStyle(.plain)
            .padding(.bottom, 12)

            LazyVStack(spacing: 12) {
                ForEach(list) { b in BookingCard(booking: b) }
            }
            if list.isEmpty {
                if store.bookings.isEmpty {
                    EmptyState(icon: "list.clipboard", title: t("No bookings yet"), text: t("Find a car and book in a minute.")) {
                        DXButton(t("Find a car"), arrow: true) { router.openBook() }
                    }
                } else {
                    EmptyState(icon: "list.clipboard", title: t("Nothing here"), text: t("Try another filter.")) {
                        DXButton(t("Show all"), variant: .ghost) { filter = "all" }
                    }
                }
            }
        }
        .refreshable { await store.refresh() }
        .sheet(isPresented: $picking) {
            SheetFrame(title: t("Show bookings")) {
                FlowLayout(spacing: 8) {
                    ForEach(Self.filters, id: \.self) { f in
                        Chip(t(Self.labels[f]!), active: filter == f) { filter = f; picking = false }
                    }
                }
            }
        }
    }
}

private struct BookingCard: View {
    @Environment(Router.self) private var router
    let booking: Booking

    var body: some View {
        let car = booking.car
        let perDay = (car.price(booking.period) / Double(booking.period.days)).rounded()
        CardButton(action: { router.push(.booking(booking.id, section: nil)) }) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(car.name).font(.dx(18, .bold)).foregroundStyle(Color.ink)
                        Text("\(String(car.year)) · \(t(car.category))").font(.dx(14)).foregroundStyle(Color.inkMuted)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        StatusDot(status: booking.status)
                        if let time = timeLabel(booking) { Badge(text: time.text, fg: time.late ? .danger : .brand, bg: time.late ? .dangerSoft : .brandSoft) }
                    }
                }
                HStack(spacing: 12) {
                    RemoteImage(path: car.image).frame(height: 96).frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 8) {
                        PriceView(value: booking.period == .daily ? perDay : car.price(booking.period), unit: t(booking.period.unit))
                        dates(t("Pickup"), Fmt.day(booking.pickup))
                        dates(t("Return"), Fmt.day(booking.dropoff))
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.top, 8)
                Rectangle().fill(Color.line).frame(height: 1).padding(.top, 12)
                HStack {
                    Button { Haptics.tap(); router.push(.booking(booking.id, section: "invoice")) } label: {
                        Label(t("Invoice"), systemImage: "doc.text").font(.dx(14, .medium)).foregroundStyle(Color.ink)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    DXButton(variant: .soft, size: .sm, action: { router.push(.booking(booking.id, section: nil)) }) {
                        Text(t("View details"))
                        Image(systemName: "chevron.right").flipsForRightToLeftLayoutDirection(true)
                    }
                }
                .padding(.top, 12)
            }
            .padding(16)
        }
    }

    private func dates(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(Color.inkFaint)
            Spacer()
            Text(value).fontWeight(.medium).foregroundStyle(Color.ink)
        }
        .font(.dx(13))
    }
}

/// One booking: the car and plate, days left, extend, invoices, Salik and fines, the car papers and help.
struct BookingDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    let id: String
    let section: String?
    @State private var paying: Invoice?
    @State private var sheet: SheetKind?
    private enum SheetKind: String, Identifiable { case extend, mulkiya, insurance; var id: String { rawValue } }

    var body: some View {
        if let b = store.bookings.first(where: { $0.id == id }) {
            content(b)
        } else {
            InnerPage(title: t("Booking details")) { EmptyView() }
        }
    }

    private func content(_ b: Booking) -> some View {
        let car = b.car
        let invoices = store.invoices.filter { $0.bookingId == b.id }
        let fines = store.fines.filter { $0.bookingId == b.id }
        let total = Fmt.date(b.dropoff).timeIntervalSince(Fmt.date(b.pickup)) / 86400
        let left = Fmt.daysUntil(b.dropoff) // UAE calendar days, the same count the booking cards show
        let active = b.status == .ongoing || b.status == .overdue
        let insured = b.extras.contains("full_cover")

        return VStack(spacing: 0) {
            BackBar(title: t("Booking details")) { StatusDot(status: b.status) }
            ScrollViewReader { proxy in
                PageScroll(bottom: 40) {
                    VStack(alignment: .leading, spacing: 0) {
                        ZStack {
                            LinearGradient(colors: [Color.tint, .white], startPoint: .top, endPoint: .bottom)
                            RemoteImage(path: car.image, multiply: true).frame(height: 150).padding(.top, 12)
                        }
                        .frame(height: 162)
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(car.name).font(.dx(20, .bold)).foregroundStyle(Color.ink)
                                    Text("\(String(car.year)) · \(t(car.category))").font(.dx(14)).foregroundStyle(Color.inkMuted)
                                }
                                Spacer()
                                Text(verbatim: b.plate).font(.system(size: 14, weight: .bold, design: .monospaced)).foregroundStyle(Color.ink)
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.ink, lineWidth: 2))
                            }
                            HStack(spacing: 12) {
                                info(t("Pickup"), Fmt.day(b.pickup))
                                info(t("Return"), Fmt.day(b.dropoff))
                            }
                            .padding(.top, 16)
                            if active {
                                VStack(spacing: 6) {
                                    HStack {
                                        Text(left < 0 ? (left == -1 ? t("{n} day overdue", ["n": -left]) : t("{n} days overdue", ["n": -left]))
                                                      : (left == 1 ? t("{n} day left", ["n": left]) : t("{n} days left", ["n": left])))
                                            .fontWeight(.semibold).foregroundStyle(left < 0 ? Color.danger : Color.ink)
                                        Spacer()
                                        Text(t("{n} days total", ["n": Int(total.rounded())])).foregroundStyle(Color.inkMuted)
                                    }
                                    .font(.dx(14))
                                    GeometryReader { g in
                                        Capsule().fill(Color.bg).overlay(alignment: .leading) {
                                            Capsule().fill(left < 0 ? Color.danger : Color.brand)
                                                .frame(width: g.size.width * min(1, max(0.04, total > 0 ? (total - Double(left)) / total : 1)))
                                        }
                                    }
                                    .frame(height: 8)
                                }
                                .padding(.top, 16)
                                DXButton(size: .lg, action: { sheet = .extend }) {
                                    Image(systemName: "timer")
                                    Text(t("Extend rental"))
                                }
                                .padding(.top, 16)
                            }
                        }
                        .padding(16)
                    }
                    .card()

                    if b.status == .overdue {
                        NoticeBox(icon: "exclamationmark.triangle") { Text(t("Your return date has passed. Extend the rental or return the car to avoid extra charges.")) }
                            .padding(.top, 12)
                    }

                    heading(t("Invoices")).id("invoice")
                    Divided {
                        ForEach(invoices) { i in invoiceRow(i, detail: "\(car.name) · \(b.plate)") }
                        if invoices.isEmpty { empty(t("No invoices yet.")) }
                    }
                    .card()

                    heading(t("Salik & fines")).id("fines")
                    Divided {
                        ForEach(fines) { f in
                            HStack(spacing: 12) {
                                let salik = f.type.hasPrefix("salik")
                                Badge(text: f.title.map { t($0) } ?? (f.type == "salik" ? t("Salik") : t("Fine")),
                                      fg: salik ? .brand : .danger, bg: salik ? .brandSoft : .dangerSoft)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(f.place).font(.dx(14, .medium)).foregroundStyle(Color.ink)
                                    Text(Fmt.shortDay(f.date)).font(.dx(12)).foregroundStyle(Color.inkMuted)
                                }
                                Spacer()
                                aed(f.amount, size: 15, weight: .semibold).foregroundStyle(Color.ink)
                            }
                            .padding(.horizontal, 16).padding(.vertical, 12).frame(minHeight: 60)
                        }
                        if fines.isEmpty { empty(t("No Salik or fines. Drive safe!")) }
                    }
                    .card()
                    if !fines.isEmpty {
                        Text(t("Salik and fines are added to your next invoice.")).font(.dx(12)).foregroundStyle(Color.inkMuted).padding(.top, 8).padding(.horizontal, 4)
                    }

                    ListGroup(title: t("Car & documents")) {
                        ListRow(icon: "doc.badge.ellipsis", label: t("Car registration (Mulkiya)")) { sheet = .mulkiya }
                        ListRow(icon: "checkmark.shield", label: t("Insurance"), value: insured ? t("Full cover") : t("Basic")) { sheet = .insurance }
                        if active {
                            ListRow(icon: "arrow.triangle.2.circlepath", label: t("Change car")) {
                                openURL(AppConfig.whatsappLink("Hi, I'd like to change my car (\(car.name), \(b.plate))."))
                            }
                        }
                        ListRow(icon: "headphones", label: t("Get help with this booking")) {
                            router.openSupport(ask: "I need help with my \(car.name) booking (\(b.plate)).")
                        }
                    }
                    .padding(.top, 24)
                }
                .task(id: section) {
                    guard let section else { return }
                    try? await Task.sleep(for: .milliseconds(350))
                    withAnimation(.easeInOut) { proxy.scrollTo(section, anchor: .top) }
                }
            }
        }
        .background(Color.bg)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $paying) { PayInvoiceSheet(invoice: $0) }
        .sheet(item: $sheet) { kind in
            switch kind {
            case .extend: ExtendSheet(booking: b)
            case .mulkiya:
                SheetFrame(title: t("Car registration")) {
                    docCard("car", [(t("Vehicle"), car.name), (t("Plate"), b.plate), (t("Year"), String(car.year)), (t("Owner"), "Drivex Car Rental LLC")])
                    Text(t("Show this screen if the police ask for the car papers.")).font(.dx(12)).foregroundStyle(Color.inkMuted).frame(maxWidth: .infinity).multilineTextAlignment(.center).padding(.top, 12)
                }
            case .insurance:
                SheetFrame(title: t("Insurance")) {
                    docCard("checkmark.shield", [(t("Cover"), insured ? t("Full cover (zero excess)") : t("Basic (third party + excess)")),
                                                 (t("Valid"), "\(Fmt.shortDay(b.pickup)) – \(Fmt.shortDay(b.dropoff))"), (t("Plate"), b.plate)])
                    if !insured {
                        Text(t("Upgrade to full coverage insurance for {n}% of the rental — ask us in Support.", ["n": Int(Pricing.fullCoverPct)]))
                            .font(.dx(14)).foregroundStyle(Color.inkMuted).padding(.top, 12)
                    }
                }
            }
        }
    }

    private func invoiceRow(_ i: Invoice, detail: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text").font(.system(size: 18)).foregroundStyle(Color.inkMuted)
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: i.number).font(.dx(15, .medium)).foregroundStyle(Color.ink)
                Text(Fmt.day(i.issued)).font(.dx(12)).foregroundStyle(Color.inkMuted)
            }
            Spacer(minLength: 4)
            InvoiceButtons(invoice: i, detail: detail)
            InvoiceStatus(invoice: i) { paying = i }
        }
        .padding(.horizontal, 16).padding(.vertical, 12).frame(minHeight: 64)
    }

    private func info(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.dx(12)).foregroundStyle(Color.inkMuted)
            Text(value).font(.dx(15, .semibold)).foregroundStyle(Color.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.bg))
    }

    private func heading(_ s: String) -> some View {
        Text(s).font(.dx(16, .semibold)).foregroundStyle(Color.ink).padding(.top, 24).padding(.bottom, 8)
    }

    private func empty(_ s: String) -> some View {
        Text(s).font(.dx(14)).foregroundStyle(Color.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(16)
    }

    // shows booking data; swap for the scanned Mulkiya / insurance PDFs once they are uploaded (as on the site)
    private func docCard(_ icon: String, _ rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: icon).font(.system(size: 20)).foregroundStyle(.white)
                .frame(width: 44, height: 44).background(RoundedRectangle(cornerRadius: 12).fill(Color.brand)).padding(.bottom, 12)
            ForEach(rows.indices, id: \.self) { k in
                HStack {
                    Text(rows[k].0).foregroundStyle(Color.inkMuted)
                    Spacer()
                    Text(rows[k].1).fontWeight(.semibold).foregroundStyle(Color.ink)
                }
                .font(.dx(14)).padding(.vertical, 8)
                if k < rows.count - 1 { Rectangle().fill(Color.line.opacity(0.7)).frame(height: 1) }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(LinearGradient(colors: [Color.brandSoft, .white], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.line))
    }
}

/// The amount, and "Paid" or a "Pay now" link.
struct InvoiceStatus: View {
    let invoice: Invoice
    let pay: () -> Void
    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            aed(invoice.amount, size: 15).foregroundStyle(Color.ink)
            if invoice.status == .paid {
                Label(t("Paid"), systemImage: "checkmark.circle").font(.dx(12)).foregroundStyle(Color.brand)
            } else {
                Button(t("Pay now"), action: pay).font(.dx(12, .semibold)).underline().foregroundStyle(Color.danger).buttonStyle(.plain)
            }
        }
    }
}

/// Extend a rental by 1, 3, 7 or 30 days: an invoice is added to the booking (api/extend.ts).
private struct ExtendSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let booking: Booking
    @State private var busy = false
    @State private var error = ""

    var body: some View {
        let perDay = (booking.car.price(booking.period) / Double(booking.period.days)).rounded()
        SheetFrame(title: t("Extend rental")) {
            (Text(t("Current return:")) + Text(" ") + Text(Fmt.day(booking.dropoff)).bold().foregroundColor(.ink))
                .font(.dx(14)).foregroundStyle(Color.inkMuted).padding(.bottom, 16)
            VStack(spacing: 8) {
                ForEach([1, 3, 7, 30], id: \.self) { d in
                    Button { extend(d) } label: {
                        HStack {
                            Text(d > 1 ? t("+ {n} days", ["n": d]) : t("+ {n} day", ["n": d])).font(.dx(16, .medium))
                            Spacer()
                            aed(perDay * Double(d), size: 16, weight: .semibold)
                        }
                        .foregroundStyle(Color.ink)
                        .padding(.horizontal, 16).frame(height: 56)
                        .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
                    }
                    .buttonStyle(PressScale())
                    .disabled(busy)
                    .opacity(busy ? 0.5 : 1)
                }
            }
            ErrorText(message: error).padding(.top, 12)
            Text(t("An invoice is added to this booking. You can pay it right away.")).font(.dx(12)).foregroundStyle(Color.inkMuted).padding(.top, 16)
        }
    }

    private func extend(_ days: Int) {
        busy = true; error = ""
        Task { @MainActor in
            do { try await store.extend(booking.id, days: days); Haptics.success(); dismiss() }
            catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}
