import SwiftUI
import Supabase

/// Home tab: greeting, banners, the customer's cars, a pending invoice, car offers and partner benefits.
struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var paying: Invoice?
    @State private var benefit: Offer?

    private static let order: [BookingStatus: Int] = [.overdue: 0, .ongoing: 1, .upcoming: 2, .pending: 3]

    var body: some View {
        let booked = store.bookings.filter { Self.order[$0.status] != nil }
            .sorted { (Self.order[$0.status]!, $0.pickup) < (Self.order[$1.status]!, $1.pickup) }
        let carOffers = store.offers.filter { $0.kind == .car }
        let partners = store.offers.filter { $0.kind == .partner }
        let pending = store.invoices.first { $0.status == .pending }

        PageScroll {
            TopBar()
            greeting
            OfflineNotice()
            BannerCarousel()

            if !booked.isEmpty {
                SectionHead(title: t("Your booked cars")) { router.select(.bookings) }
                rail {
                    ForEach(booked) { b in BookedCarCard(booking: b) { router.push(.booking(b.id, section: nil)) } }
                }
            }

            if let pending {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text").font(.system(size: 18)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(RoundedRectangle(cornerRadius: 12).fill(Color.danger))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t("Pending invoice")).font(.dx(13, .medium)).foregroundStyle(Color.danger)
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            aed(pending.amount, size: 20).foregroundStyle(Color.ink)
                            Text(Fmt.day(pending.issued)).font(.dx(12)).foregroundStyle(Color.inkMuted)
                        }
                    }
                    Spacer(minLength: 4)
                    DXButton(t("Pay now"), size: .sm, arrow: true) { paying = pending }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.dangerSoft))
                .padding(.top, 16)
            }

            if !carOffers.isEmpty {
                SectionHead(title: t("Your Offers")) { router.openBook(offersOnly: true) }
                rail {
                    ForEach(carOffers) { o in
                        if let car = o.car { OfferCard(car: car, off: o.off) { router.push(.reserve(carId: car.id, period: .daily, off: o.off, from: nil, to: nil)) } }
                    }
                }
            }

            if !partners.isEmpty {
                SectionHead(title: t("DriveX Community"))
                rail {
                    ForEach(partners) { o in PartnerCard(offer: o) { benefit = o } }
                }
            }
        }
        .refreshable { await store.refresh() }
        .sheet(item: $paying) { PayInvoiceSheet(invoice: $0) }
        .sheet(item: $benefit) { BenefitSheet(offer: $0) }
    }

    /// "Good evening, Sara" with the name in the brand colour.
    private var greeting: some View {
        let parts = t("{greeting}, {name}", ["greeting": t(Fmt.greeting()), "name": "@@"]).components(separatedBy: "@@")
        let title = Text(parts.first ?? "") + Text(store.user?.firstName ?? "").foregroundColor(.brand) + Text(parts.count > 1 ? parts[1] : "")
        return PageTitle(text: title, sub: t("Your next journey, beautifully taken care of.")).appear()
    }

    /// A row of cards that scrolls sideways, edge to edge.
    private func rail<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 12) { content() }.padding(.horizontal, 20).padding(.bottom, 4)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -20)
    }
}

/// The marketing banners, sliding by themselves every five seconds unless the customer is touching them.
private struct BannerCarousel: View {
    @Environment(Router.self) private var router
    @State private var index: Int? = 0
    @State private var heldUntil = Date.distantPast

    var body: some View {
        VStack(spacing: 10) {
            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(Array(Catalog.banners.enumerated()), id: \.offset) { i, b in
                        slide(b).containerRelativeFrame(.horizontal) { w, _ in w - 12 }.id(i)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, 20, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $index)
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20)
            .simultaneousGesture(DragGesture(minimumDistance: 4).onChanged { _ in heldUntil = Date().addingTimeInterval(4) })

            HStack(spacing: 6) {
                ForEach(Catalog.banners.indices, id: \.self) { k in
                    Button { withAnimation { index = k } } label: {
                        Capsule().fill(k == (index ?? 0) ? Color.ink : Color.inkFaint.opacity(0.5)).frame(width: k == (index ?? 0) ? 16 : 6, height: 6)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(t("Slide {n}", ["n": k + 1]))
                }
            }
            .animation(.easeOut(duration: 0.2), value: index)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if Date() > heldUntil { withAnimation(.easeInOut(duration: 0.5)) { index = ((index ?? 0) + 1) % Catalog.banners.count } }
            }
        }
    }

    private func slide(_ b: Catalog.Banner) -> some View {
        ZStack(alignment: .topLeading) {
            Image(b.image).resizable().scaledToFill().frame(height: 190).clipped()
            LinearGradient(colors: [.black.opacity(0.75), .black.opacity(0.35), .clear], startPoint: .leading, endPoint: .trailing)
            VStack(alignment: .leading, spacing: 0) {
                Text(t(b.kicker).uppercased()).font(.dx(10, .semibold)).tracking(1.5).foregroundStyle(.white.opacity(0.7))
                Text(t(b.title)).font(.dx(26, .bold)).foregroundStyle(.white).lineSpacing(-2).padding(.top, 4)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.trailing, 120)
                Text(t(b.text)).font(.dx(13)).foregroundStyle(.white.opacity(0.8)).padding(.top, 6).padding(.trailing, 140)
                Spacer(minLength: 8)
                Button {
                    Haptics.tap()
                    if case .book(let p) = b.to { router.openBook(period: p) }
                } label: {
                    HStack(spacing: 6) {
                        Text(t(b.cta))
                        Image(systemName: "arrow.right").flipsForRightToLeftLayoutDirection(true)
                    }
                    .font(.dx(14, .semibold)).foregroundStyle(Color.ink)
                    .padding(.horizontal, 12).frame(height: 36)
                    .background(RoundedRectangle(cornerRadius: 8).fill(.white))
                }
                .buttonStyle(PressScale(scale: 0.95))
            }
            .padding(16)
        }
        .frame(height: 190)
        .background(Color.hero)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

/// One of the customer's current cars, with its status and the days left.
private struct BookedCarCard: View {
    let booking: Booking
    let action: () -> Void
    var body: some View {
        CardButton(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    LinearGradient(colors: [Color.tint, .white], startPoint: .top, endPoint: .bottom)
                    RemoteImage(path: booking.car.image, multiply: true).padding(8)
                    StatusDot(status: booking.status).padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(.white.opacity(0.9))).padding(8)
                }
                .frame(height: 100)
                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.car.name).font(.dx(14, .semibold)).foregroundStyle(Color.ink).lineLimit(1)
                    Text("\(Fmt.day(booking.pickup)) – \(Fmt.day(booking.dropoff))").font(.dx(12)).foregroundStyle(Color.inkMuted).lineLimit(1)
                    if let time = timeLabel(booking) {
                        Badge(text: time.text, fg: time.late ? .danger : .brand, bg: time.late ? .dangerSoft : .brandSoft).padding(.top, 6)
                    }
                }
                .padding(12)
            }
            .frame(width: 190, alignment: .leading)
        }
    }
}

private struct OfferCard: View {
    let car: Car
    let off: Int
    let action: () -> Void
    var body: some View {
        CardButton(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    LinearGradient(colors: [Color.tint, .white], startPoint: .top, endPoint: .bottom)
                    RemoteImage(path: car.image, multiply: true).padding(8)
                    Badge(text: t("{n}% off", ["n": off]), fg: .white, bg: .danger).padding(8)
                }
                .frame(height: 100)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(car.name).font(.dx(14, .semibold)).foregroundStyle(Color.ink).lineLimit(1)
                            Text("\(t(car.category)) · \(String(car.year))").font(.dx(12)).foregroundStyle(Color.inkMuted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.inkFaint).flipsForRightToLeftLayoutDirection(true)
                    }
                    PriceView(value: (car.daily * (1 - Double(off) / 100)).rounded(), unit: t("day"), old: car.daily, size: 16)
                }
                .padding(12)
            }
            .frame(width: 170, alignment: .leading)
        }
    }
}

private struct PartnerCard: View {
    let offer: Offer
    let action: () -> Void
    var body: some View {
        CardButton(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                if offer.image != nil { RemoteImage(path: offer.image, fill: true).frame(width: 170, height: 100).clipped() }
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(offer.title).font(.dx(14, .semibold)).foregroundStyle(Color.ink).lineLimit(1)
                        if let s = offer.subtitle { Text(s).font(.dx(12)).foregroundStyle(Color.inkMuted).lineLimit(1) }
                    }
                    Spacer(minLength: 4)
                    Badge(text: t("{n}% off", ["n": offer.off]), fg: .danger, bg: .dangerSoft)
                }
                .padding(12)
            }
            .frame(width: 170, alignment: .leading)
        }
    }
}

/// A partner benefit, with the customer's own code to show at the venue.
private struct BenefitSheet: View {
    let offer: Offer
    var body: some View {
        SheetFrame(title: offer.title) {
            if offer.image != nil { RemoteImage(path: offer.image, fill: true).frame(height: 176).frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 14)) }
            HStack {
                Text([offer.subtitle, offer.location].compactMap { $0 }.joined(separator: " · ")).font(.dx(15)).foregroundStyle(Color.inkMuted)
                Spacer()
                Badge(text: t("{n}% off", ["n": offer.off]), fg: .white, bg: .danger)
            }
            .padding(.top, 16)
            if let d = offer.description { Text(d).font(.dx(15)).foregroundStyle(Color.ink).padding(.top, 8) }
            BenefitCode(offerId: offer.id)
            if let terms = offer.terms { Text(terms).font(.dx(12)).foregroundStyle(Color.inkMuted).padding(.top, 16) }
        }
    }
}

/// The customer's own code for a partner offer (created on first open), with a copy button.
private struct BenefitCode: View {
    let offerId: String
    @State private var code = ""
    @State private var copied = false
    @State private var shown = false

    var body: some View {
        VStack(spacing: 4) {
            Text(t("Your personal code — show it at the venue").uppercased()).font(.dx(12)).tracking(1.5).foregroundStyle(Color.brand)
            if code.isEmpty {
                ProgressView().tint(Color.brand).padding(.top, 8)
            } else {
                Text(verbatim: code).font(.system(size: 24, weight: .bold, design: .monospaced)).tracking(2).foregroundStyle(Color.brand)
                DXButton(variant: .ghost, size: .sm, action: copy) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    Text(copied ? t("Copied") : t("Copy code"))
                }
                .padding(.top, 8)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.brandSoft))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.brand, style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
        .scaleEffect(shown ? 1 : 0.9)
        .opacity(shown ? 1 : 0)
        .padding(.top, 20)
        .task(id: offerId) {
            withAnimation(.spring().delay(0.15)) { shown = true }
            code = ""
            let out: JSON? = try? await supabase.rpc("my_offer_code", params: ["p_offer": offerId]).execute().value
            code = out?.string ?? ""
        }
    }

    private func copy() {
        UIPasteboard.general.string = code
        copied = true
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.8))
            copied = false
        }
    }
}

/// "Pull down to try again" when the last load failed.
struct OfflineNotice: View {
    @Environment(AppStore.self) private var store
    var body: some View {
        if store.offline {
            NoticeBox(fg: .warnText, bg: .warnSoft, icon: "wifi.slash") { Text(t("Could not load your data. Pull down to try again.")) }
                .padding(.bottom, 16)
        }
    }
}
