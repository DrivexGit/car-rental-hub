import SwiftUI

/// Booking step 1 of 3: the car, its photos and specs, the rental plan, extras and the deposit option.
struct ReserveView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    let carId: String
    @State private var period: Period
    @State private var pickup: String
    @State private var qty: Int
    @State private var extras: [String] = ["full_cover"]
    @State private var noDeposit = false
    @State private var picking = false
    @State private var photo: Int?
    @State private var needDocs = false
    @State private var needEmail = false

    init(carId: String, period: Period, off: Int, from: String?, to: String?) {
        self.carId = carId
        _period = State(initialValue: period)
        _pickup = State(initialValue: from ?? Fmt.addDays(Fmt.todayInUAE(), 1))
        if let from, let to {
            _qty = State(initialValue: max(1, Int((Double(Fmt.daysBetween(from, to)) / Double(period.days)).rounded(.up))))
        } else {
            _qty = State(initialValue: period == .daily ? 3 : 1)
        }
    }

    var body: some View {
        if let car = store.car(carId) { content(car) } else { Color.bg.toolbar(.hidden, for: .navigationBar) }
    }

    private func content(_ car: Car) -> some View {
        let off = store.offers.first { $0.kind == .car && $0.car?.id == carId }?.off ?? 0
        let specs = store.specs[car.id]
        let q = Quote(car: car, period: period, qty: qty, pickup: pickup, extras: noDeposit ? extras + ["no_deposit"] : extras, off: off)
        // the album: the studio photo first, then the gallery
        var album: [String] = []
        for p in [car.image] + (specs?.gallery ?? []) where !p.isEmpty && !album.contains(p) { album.append(p) }

        return VStack(spacing: 0) {
            BackBar(title: t("Book your car")) { Text(t("1 of 3")).font(.dx(14)).foregroundStyle(Color.inkMuted) }
            PageScroll(bottom: 24) {
                carCard(car, off: off, album: album, hasGallery: !(specs?.gallery.isEmpty ?? true))
                if let specs { specsGrid(specs) }
                plan(q)
                extrasCard
                depositCard
            }
            BottomBar {
                HStack(alignment: .firstTextBaseline) {
                    Text(t("Total · {count}", ["count": periodCount(period, qty)])).font(.dx(15)).foregroundStyle(Color.inkMuted)
                    Spacer()
                    aed(q.total, size: 24).foregroundStyle(Color.ink)
                }
                if needDocs && !store.missingDocuments.isEmpty {
                    notice(t("Please update your documents first: {list}.", ["list": store.missingDocuments.map { t($0.label) }.joined(separator: ", ")]), button: t("Update documents")) {
                        router.push(.documents)
                    }
                }
                if needEmail && store.user?.email == nil {
                    notice(t("Add your email before you book. We send the booking details there."), button: t("Add your email")) { router.push(.editProfile) }
                }
                DXButton(t("Continue"), size: .lg, arrow: true) {
                    if !store.missingDocuments.isEmpty { withAnimation { needDocs = true }; return }
                    if store.user?.email == nil { withAnimation { needEmail = true }; return }
                    router.push(.checkout(q))
                }
            }
        }
        .background(Color.bg)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $picking) { DateSheet(value: pickup) { pickup = $0 } }
        .fullScreenCover(item: Binding(get: { photo.map { PhotoIndex(index: $0) } }, set: { photo = $0?.index })) { p in
            PhotoAlbum(photos: album, name: car.name, index: p.index)
        }
    }

    private func carCard(_ car: Car, off: Int, album: [String], hasGallery: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                LinearGradient(colors: [Color.tint, .white], startPoint: .top, endPoint: .bottom)
                RemoteImage(path: car.image, multiply: true).frame(height: 170).padding(.horizontal, 16).padding(.top, 16)
            }
            .frame(height: 186)
            .contentShape(Rectangle())
            .onTapGesture { if album.count > 1 { photo = 0 } }
            if hasGallery {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(Array(album.enumerated()), id: \.offset) { i, src in
                            Button { photo = i } label: {
                                RemoteImage(path: src, fill: true).frame(width: 112, height: 80).background(Color.line).clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .buttonStyle(PressScale(scale: 0.95))
                            .accessibilityLabel(t("{name} photo {n}", ["name": car.name, "n": i + 1]))
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                }
                .scrollIndicators(.hidden)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(car.name).font(.dx(24, .bold)).foregroundStyle(Color.ink)
                FlowLayout(spacing: 16) {
                    Text("\(String(car.year)) · \(t(car.category))")
                    Label(t("{n} seats", ["n": car.seats]), systemImage: "person.2")
                    Text(t("{n} in fleet", ["n": car.vehicleIds.count]))
                    Label(t("Full to full"), systemImage: "fuelpump")
                }
                .font(.dx(14)).foregroundStyle(Color.inkMuted)
                PriceView(value: (car.price(period) * (1 - Double(off) / 100)).rounded(), unit: t(period.unit), old: off > 0 ? car.price(period) : nil)
                    .padding(.top, 4)
            }
            .padding(16)
        }
        .card()
    }

    private func specsGrid(_ s: Specs) -> some View {
        let items: [(icon: String, value: String, label: String)] = [
            ("gauge.with.needle", s.engine ?? "—", "Engine"), ("gearshape.2", s.transmission, "Gearbox"), ("fuelpump", s.fuel, "Fuel"),
            ("person.2", t("{n} seats", ["n": s.seats]), "Seats"), ("door.left.hand.open", t("{n} doors", ["n": s.doors]), "Doors"),
            ("suitcase", t("{n} bags", ["n": s.bags]), "Luggage"),
        ]
        return VStack(alignment: .leading, spacing: 0) {
            heading(t("About this car"))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(items.indices, id: \.self) { i in
                    VStack(spacing: 4) {
                        Image(systemName: items[i].icon).font(.system(size: 18)).foregroundStyle(Color.brand)
                        Text(items[i].value).font(.dx(13, .semibold)).foregroundStyle(Color.ink).lineLimit(2)
                        Text(t(items[i].label)).font(.dx(11)).foregroundStyle(Color.inkFaint)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .card()
                    .appear(delay: 0.05 * Double(i))
                }
            }
            if !s.features.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(s.features, id: \.self) { f in
                        Label(f, systemImage: "sparkles").font(.dx(13, .medium)).foregroundStyle(Color.brand)
                            .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(Color.brandSoft))
                    }
                }
                .padding(.top, 12)
            }
        }
    }

    private func plan(_ q: Quote) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(t("Rental plan"))
            Segmented(value: period, options: Period.allCases.map { ($0, t($0.label)) }) { p in
                period = p
                qty = p == .daily ? 3 : 1
            }
            Divided {
                Button { Haptics.tap(); picking = true } label: {
                    HStack {
                        Text(t("Pickup date")).font(.dx(16, .medium)).foregroundStyle(Color.ink)
                        Spacer()
                        Label(Fmt.day(pickup), systemImage: "calendar").font(.dx(16, .semibold)).foregroundStyle(Color.brand)
                    }
                    .padding(.horizontal, 16).frame(height: 64).contentShape(Rectangle())
                }
                .buttonStyle(RowPress())
                HStack {
                    Text(period == .daily ? t("Number of days") : period == .weekly ? t("Number of weeks") : t("Number of months"))
                        .font(.dx(16, .medium)).foregroundStyle(Color.ink)
                    Spacer()
                    HStack(spacing: 16) {
                        round("minus", t("Less")) { qty = max(1, qty - 1) }
                        Text("\(qty)").font(.dx(18, .bold)).foregroundStyle(Color.ink).frame(width: 28).contentTransition(.numericText())
                        round("plus", t("More")) { qty = min(period == .daily ? 29 : 12, qty + 1) }
                    }
                }
                .padding(.horizontal, 16).frame(height: 64)
                HStack {
                    Text(t("Return")).foregroundStyle(Color.inkMuted)
                    Spacer()
                    Text(Fmt.shortDay(q.dropoff)).fontWeight(.semibold).foregroundStyle(Color.ink)
                }
                .font(.dx(14)).padding(.horizontal, 16).frame(height: 56)
            }
            .card()
            .padding(.top, 12)
        }
    }

    private var extrasCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(t("Extras"))
            Divided {
                ForEach(Pricing.pickableExtras, id: \.self) { id in
                    let on = extras.contains(id)
                    Button {
                        Haptics.tap()
                        if on { extras.removeAll { $0 == id } } else { extras.append(id) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(on ? .white : .clear)
                                .frame(width: 24, height: 24)
                                .background(RoundedRectangle(cornerRadius: 6).fill(on ? Color.brand : .white))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(on ? Color.brand : Color.line, lineWidth: 2))
                            HStack(spacing: 6) {
                                Text(t(Pricing.extraLabels[id] ?? id)).font(.dx(16, .medium)).foregroundStyle(Color.ink)
                                if id == "full_cover" { Image(systemName: "checkmark.shield").font(.system(size: 14)).foregroundStyle(Color.brand) }
                            }
                            Spacer(minLength: 8)
                            extraHint(id).font(.dx(14)).foregroundStyle(Color.inkMuted)
                        }
                        .padding(.horizontal, 16).frame(minHeight: 60).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .card()
        }
    }

    /// What each extra costs, in words (the amounts come from Pricing).
    private func extraHint(_ id: String) -> Text {
        if id == "full_cover" { return Text(t("{n}% of the rental", ["n": Int(Pricing.fullCoverPct)])) }
        if id == "extra_driver" && period == .monthly { return Dirham.text(14) + Text(" " + t("{n} / month", ["n": Int(Pricing.driverMonthly)])) }
        return Dirham.text(14) + Text(" " + t("{n} / day", ["n": Int(id == "extra_driver" ? Pricing.driverDaily : Pricing.childSeatDaily)]))
    }

    private var depositCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(t("Security deposit"))
            Divided {
                depositRow(none: false, title: "Refundable deposit", text: "Blocked on your card at pickup and released after the return.", price: aed(Pricing.depositAmount, size: 14, weight: .semibold))
                depositRow(none: true, title: "No deposit", text: "Pay once. Nothing is blocked on your card.", price: Text("+ ").font(.dx(14, .semibold)) + aed(Pricing.noDepositFee, size: 14, weight: .semibold))
            }
            .card()
        }
    }

    private func depositRow(none: Bool, title: String, text: String, price: Text) -> some View {
        let on = noDeposit == none
        return Button { Haptics.tap(); noDeposit = none } label: {
            HStack(spacing: 12) {
                Circle().stroke(on ? Color.brand : Color.line, lineWidth: 2).frame(width: 24, height: 24)
                    .overlay { if on { Circle().fill(Color.brand).frame(width: 12, height: 12) } }
                VStack(alignment: .leading, spacing: 2) {
                    Text(t(title)).font(.dx(16, .medium)).foregroundStyle(Color.ink)
                    Text(t(text)).font(.dx(13)).foregroundStyle(Color.inkMuted)
                }
                Spacer(minLength: 8)
                price.foregroundStyle(Color.ink)
            }
            .padding(.horizontal, 16).padding(.vertical, 8).frame(minHeight: 64).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func heading(_ s: String) -> some View {
        Text(s).font(.dx(16, .semibold)).foregroundStyle(Color.ink).padding(.top, 24).padding(.bottom, 8)
    }

    private func round(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); withAnimation(.snappy) { action() } } label: {
            Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.ink)
                .frame(width: 36, height: 36).background(Circle().fill(.white)).overlay(Circle().stroke(Color.line))
        }
        .buttonStyle(PressScale(scale: 0.9))
        .accessibilityLabel(label)
    }

    private func notice(_ message: String, button: String, action: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Text(message).font(.dx(14, .medium)).foregroundStyle(Color.danger).frame(maxWidth: .infinity, alignment: .leading)
            DXButton(button, size: .sm, action: action)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.dangerSoft))
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }
}

private struct PhotoIndex: Identifiable { let index: Int; var id: Int { index } }

/// Full-screen photo viewer: swipe or the arrows for the previous / next photo, the counter, a close button.
struct PhotoAlbum: View {
    let photos: [String]
    let name: String
    @State var index: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.opacity(0.95).ignoresSafeArea().onTapGesture { dismiss() }
            TabView(selection: $index) {
                ForEach(photos.indices, id: \.self) { i in
                    RemoteImage(path: photos[i]).clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 16).containerRelativeFrame(.vertical) { h, _ in h * 0.85 }
                        .tag(i)
                        .accessibilityLabel(t("{name} photo {n}", ["name": name, "n": i + 1]))
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            if photos.count > 1 {
                HStack {
                    arrow("chevron.left", t("Previous photo")) { index = (index - 1 + photos.count) % photos.count }
                    Spacer()
                    arrow("chevron.right", t("Next photo")) { index = (index + 1) % photos.count }
                }
                .padding(.horizontal, 12)
                VStack {
                    Spacer()
                    Text("\(index + 1) / \(photos.count)").font(.dx(14, .medium)).foregroundStyle(.white.opacity(0.8))
                        .environment(\.layoutDirection, .leftToRight).padding(.bottom, 24)
                }
            }
            VStack {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.15)))
                    }
                    .accessibilityLabel(t("Close photo"))
                }
                Spacer()
            }
            .padding(16)
        }
        .animation(.easeInOut(duration: 0.25), value: index)
    }

    private func arrow(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Image(systemName: icon).font(.system(size: 20, weight: .semibold)).flipsForRightToLeftLayoutDirection(true).foregroundStyle(.white)
                .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.15)))
        }
        .accessibilityLabel(label)
    }
}
