import SwiftUI
import Supabase

/// Book tab: every model for the chosen period, with search, sort, filters, optional dates and "offers only".
struct BookView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router

    private enum Sort: String, CaseIterable { case low, high, name
        var label: String {
            switch self {
            case .low: "Price: low to high"
            case .high: "Price: high to low"
            case .name: "Name A–Z"
            }
        }
    }
    private enum SheetKind: String, Identifiable { case dates, sort, filter; var id: String { rawValue } }

    @State private var query = ""
    @State private var sort: Sort = .high
    @State private var category = "All"
    @State private var brand = "All"
    @State private var year = "All"
    @State private var seats = "All"
    @State private var sheet: SheetKind?
    @State private var from = ""
    @State private var to = ""
    /// With dates: vehicles already booked in that range, so models with no free unit are hidden.
    @State private var busy: Set<String> = []

    private var filtered: Bool { category != "All" || brand != "All" || year != "All" || seats != "All" }
    private var offerOff: [String: Int] {
        Dictionary(store.offers.compactMap { o in o.kind == .car ? o.car.map { ($0.id, o.off) } : nil }, uniquingKeysWith: { a, _ in a })
    }

    private var cars: [Car] {
        let term = query.trimmingCharacters(in: .whitespaces).lowercased()
        let period = router.bookPeriod
        let offers = offerOff
        let offersOnly = router.bookOffersOnly
        return store.fleet.filter { (c: Car) -> Bool in
            guard c.vehicleIds.contains(where: { !busy.contains($0) }) else { return false }
            if offersOnly && offers[c.id] == nil { return false }
            if category != "All" && c.category != category { return false }
            if brand != "All" && c.make != brand { return false }
            if year != "All" && String(c.year) != year { return false }
            if seats != "All" && String(c.seats) != seats { return false }
            let haystack = "\(c.make) \(c.name) \(c.category)".lowercased()
            return term.isEmpty || haystack.contains(term)
        }
        .sorted { a, b in
            switch sort {
            case .name: a.name.localizedCompare(b.name) == .orderedAscending
            case .low: a.price(period) < b.price(period)
            case .high: a.price(period) > b.price(period)
            }
        }
    }

    var body: some View {
        let list = cars
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                VStack(alignment: .leading, spacing: 0) {
                    TopBar()
                    PageTitle(t("Find your drive"))
                }
                .padding(.horizontal, 20)

                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        datesCard
                        if !offerOff.isEmpty {
                            Chip(active: router.bookOffersOnly, action: { router.bookOffersOnly.toggle() }) {
                                Image(systemName: "tag"); Text(t("Offers only"))
                            }
                        }
                        ForEach(Array(list.enumerated()), id: \.element.id) { i, c in
                            CarCard(car: c, period: router.bookPeriod, off: router.bookOffersOnly ? offerOff[c.id] ?? 0 : 0) { open(c) }
                                .appear(delay: Double(min(i, 6)) * 0.05)
                        }
                        if list.isEmpty {
                            EmptyState(icon: "magnifyingglass",
                                       title: router.bookOffersOnly ? t("No offers right now") : t("No cars found"),
                                       text: router.bookOffersOnly ? t("Turn off Offers only to see every car.") : t("Try another name or clear the filter.")) {
                                DXButton(t("Clear"), variant: .ghost) { clearAll() }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                } header: {
                    controls
                }
            }
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .background(Color.bg)
        .refreshable { await store.refresh() }
        .task(id: "\(from)|\(to)") { await loadBusy() }
        .sheet(item: $sheet) { kind in
            switch kind {
            case .sort: sortSheet
            case .filter: filterSheet
            case .dates: DateRangeSheet(from: from, to: to, onApply: { from = $0; to = $1 }, onClear: { from = ""; to = "" })
            }
        }
    }

    /// Period, search, sort and filter stay pinned at the top while the list scrolls.
    private var controls: some View {
        VStack(spacing: 12) {
            Segmented(value: router.bookPeriod, options: Period.allCases.map { ($0, t($0.label)) }) { router.bookPeriod = $0 }
            HStack(spacing: 8) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Color.inkMuted)
                    TextField(t("Search cars"), text: $query).font(.dx(15)).submitLabel(.search).autocorrectionDisabled()
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
                iconButton("arrow.up.arrow.down", t("Sort")) { sheet = .sort }
                iconButton("slider.horizontal.3", t("Filter"), dot: filtered) { sheet = .filter }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Color.bg.opacity(0.95).background(.ultraThinMaterial))
    }

    private func iconButton(_ icon: String, _ label: String, dot: Bool = false, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color.ink)
                .frame(width: 48, height: 48)
                .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
                .overlay(alignment: .topTrailing) { if dot { Circle().fill(Color.brand).frame(width: 8, height: 8).padding(10) } }
        }
        .buttonStyle(PressScale(scale: 0.95))
        .accessibilityLabel(label)
    }

    private var datesCard: some View {
        CardButton(action: { sheet = .dates }) {
            HStack(spacing: 12) {
                Image(systemName: "calendar").font(.system(size: 18))
                Group {
                    if !from.isEmpty && !to.isEmpty {
                        Text("\(Fmt.shortDay(from)) – \(Fmt.shortDay(to))")
                    } else {
                        Text(t("Add rental dates")) + Text(" " + t("(optional)")).fontWeight(.regular).foregroundColor(.inkFaint)
                    }
                }
                .font(.dx(15, .medium))
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.inkFaint).flipsForRightToLeftLayoutDirection(true)
            }
            .foregroundStyle(Color.ink)
            .padding(.horizontal, 16)
            .frame(height: 56)
        }
    }

    private var sortSheet: some View {
        SheetFrame(title: t("Sort by")) {
            VStack(spacing: 8) {
                ForEach(Sort.allCases, id: \.self) { k in
                    Button { sort = k; sheet = nil } label: {
                        Text(t(k.label)).font(.dx(15, .medium)).foregroundStyle(sort == k ? Color.brand : Color.ink)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).frame(height: 56)
                            .background(RoundedRectangle(cornerRadius: 12).fill(sort == k ? Color.brandSoft : .white))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(sort == k ? Color.brand : Color.line))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var filterSheet: some View {
        let uniq = { (xs: [String]) in Array(Set(xs)).sorted() }
        let groups: [(label: String, options: [String], value: Binding<String>)] = [
            ("Car type", ["All"] + uniq(store.fleet.map(\.category)), $category),
            ("Brand", ["All"] + uniq(store.fleet.map(\.make)), $brand),
            ("Year", ["All"] + uniq(store.fleet.map { String($0.year) }.filter { $0 != "0" }).reversed(), $year),
            ("Seats", ["All"] + uniq(store.fleet.map { String($0.seats) }), $seats),
        ]
        let count = cars.count
        return SheetFrame(title: t("Filter")) {
            ForEach(groups, id: \.label) { g in
                VStack(alignment: .leading, spacing: 8) {
                    Text(t(g.label)).font(.dx(14, .semibold)).foregroundStyle(Color.inkMuted)
                    FlowLayout(spacing: 8) {
                        ForEach(g.options, id: \.self) { k in
                            Chip(chipLabel(g.label, k), active: g.value.wrappedValue == k) { g.value.wrappedValue = k }
                        }
                    }
                }
                .padding(.bottom, 20)
            }
            HStack(spacing: 8) {
                if filtered { DXButton(t("Clear"), variant: .ghost, size: .lg) { clearAll() }.fixedSize() }
                DXButton(count == 1 ? t("Show {n} car", ["n": count]) : t("Show {n} cars", ["n": count]), size: .lg) { sheet = nil }
            }
        }
    }

    private func chipLabel(_ group: String, _ k: String) -> String {
        if group == "Seats" && k != "All" { return t("{n} seats", ["n": k]) }
        return k == "All" || group == "Car type" ? t(k) : k
    }

    private func clearAll() { query = ""; category = "All"; brand = "All"; year = "All"; seats = "All" }

    private func open(_ c: Car) {
        let off = router.bookOffersOnly ? offerOff[c.id] ?? 0 : 0
        router.push(.reserve(carId: c.id, period: router.bookPeriod, off: off, from: from.isEmpty ? nil : from, to: to.isEmpty ? nil : to))
    }

    private func loadBusy() async {
        guard !from.isEmpty, !to.isEmpty else { busy = []; return }
        let ids: [JSON]? = try? await supabase.rpc("busy_vehicle_ids", params: ["p_from": "\(from)T00:00:00+04:00", "p_to": "\(to)T23:59:59+04:00"]).execute().value
        busy = Set((ids ?? []).compactMap(\.string))
    }
}

/// One model in the list: the whole card opens it, the button too.
private struct CarCard: View {
    let car: Car
    let period: Period
    let off: Int
    let open: () -> Void

    var body: some View {
        let base = car.price(period)
        CardButton(action: open) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Text(car.name).font(.dx(18, .bold)).foregroundStyle(Color.ink)
                    Spacer()
                    if off > 0 { Badge(text: t("{n}% off", ["n": off]), fg: .white, bg: .danger) }
                }
                HStack(spacing: 6) {
                    Text("\(String(car.year)) · \(t(car.category)) ·")
                    Image(systemName: "person.2").font(.system(size: 12))
                    Text(t("{n} seats", ["n": car.seats]))
                }
                .font(.dx(14)).foregroundStyle(Color.inkMuted)
                RemoteImage(path: car.image).frame(height: 130).frame(maxWidth: .infinity).padding(.vertical, 8)
                HStack {
                    PriceView(value: off > 0 ? (base * (1 - Double(off) / 100)).rounded() : base, unit: t(period.unit), old: off > 0 ? base : nil)
                    Spacer(minLength: 8)
                    DXButton(t("View & book"), size: .sm, arrow: true, action: open)
                }
            }
            .padding(16)
        }
    }
}

/// Wraps chips onto as many lines as they need.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? .infinity, subviews)
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: rows.last.map { $0.y + $0.height } ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for row in arrange(bounds.width, subviews) {
            var x = bounds.minX
            for i in row.items {
                let s = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: bounds.minY + row.y), proposal: ProposedViewSize(s))
                x += s.width + spacing
            }
        }
    }

    private struct Row { var items: [Int] = []; var y: CGFloat = 0; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(_ maxWidth: CGFloat, _ subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for i in subviews.indices {
            let s = subviews[i].sizeThatFits(.unspecified)
            if !rows[rows.count - 1].items.isEmpty && rows[rows.count - 1].width + spacing + s.width > maxWidth {
                let last = rows[rows.count - 1]
                rows.append(Row(y: last.y + last.height + spacing))
            }
            var r = rows[rows.count - 1]
            r.width += (r.items.isEmpty ? 0 : spacing) + s.width
            r.height = max(r.height, s.height)
            r.items.append(i)
            rows[rows.count - 1] = r
        }
        return rows
    }
}
