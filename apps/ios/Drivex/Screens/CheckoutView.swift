import SwiftUI

/// Booking step 2 of 3: summary and payment. The server re-prices and picks a free car (api/book.ts).
struct CheckoutView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    let quote: Quote
    @State private var agreed = false
    @State private var busy = false
    @State private var error = ""
    @State private var page: CheckoutPage?
    @State private var reservationId: String?
    @State private var terms = false

    var body: some View {
        if let car = store.car(quote.carId) {
            content(car)
                // documents were removed or rejected since step 1
                .onAppear { if !store.missingDocuments.isEmpty { dismiss() } }
        } else {
            Color.bg.toolbar(.hidden, for: .navigationBar)
        }
    }

    private func content(_ car: Car) -> some View {
        VStack(spacing: 0) {
            BackBar(title: t("Review & pay")) { Text(t("2 of 3")).font(.dx(14)).foregroundStyle(Color.inkMuted) }
            PageScroll(bottom: 24) {
                HStack(spacing: 12) {
                    RemoteImage(path: car.image).frame(width: 96, height: 64)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(car.name).font(.dx(16, .bold)).foregroundStyle(Color.ink)
                        Text("\(periodCount(quote.period, quote.qty)) · \(t(car.category))").font(.dx(14)).foregroundStyle(Color.inkMuted)
                    }
                    Spacer()
                }
                .padding(12).card()

                Divided {
                    row(Text(t("Pickup")), Text(Fmt.day(quote.pickup)))
                    row(Text(t("Return")), Text(Fmt.day(quote.dropoff)))
                    row(Text(t("Pickup location")), Text(t("Drivex, Dubai")))
                }
                .card().padding(.top, 12)

                heading(t("Price"))
                Divided {
                    row(Text(quote.discount > 0 ? t("Rental ({n}% off)", ["n": quote.discount]) : t("Rental")), aed(quote.base, size: 15, weight: .medium))
                    ForEach(quote.extras.filter { Pricing.extraLabels[$0] != nil }, id: \.self) { id in
                        row(Text(t(Pricing.extraLabels[id]!)), aed(quote.cost(of: id), size: 15, weight: .medium))
                    }
                    row(Text(t("VAT included")), aed(quote.vat, size: 15, weight: .medium))
                    row(Text(t("Total")).bold().foregroundColor(.ink), aed(quote.total, size: 20))
                }
                .card()

                NoticeBox(fg: .brand, bg: .brandSoft, icon: "info.circle") {
                    if quote.extras.contains("no_deposit") {
                        Text(t("No deposit is blocked on your card."))
                    } else {
                        // the amount keeps its dirham sign, so the sentence is split around it
                        let parts = t("A refundable security deposit (from {amount}) is blocked on your card at pickup.", ["amount": "@@"]).components(separatedBy: "@@")
                        Text(parts[0]) + aed(Pricing.depositAmount, size: 14, weight: .regular) + Text(parts.count > 1 ? parts[1] : "")
                    }
                }
                .padding(.top, 12)

                Button { Haptics.tap(); agreed.toggle() } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: agreed ? "checkmark.square.fill" : "square").font(.system(size: 20)).foregroundStyle(agreed ? Color.brand : Color.inkFaint)
                        Text(t("I agree to the Terms & Rental rules")).foregroundStyle(Color.ink)
                            .font(.dx(15))
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(16)
                    .card()
                }
                .buttonStyle(.plain)
                .padding(.top, 24)
                .accessibilityAddTraits(agreed ? .isSelected : [])
                Button(t("Read the terms")) { terms = true }.font(.dx(14, .semibold)).foregroundStyle(Color.brand).padding(.top, 8).padding(.horizontal, 4)

                heading(t("Payment"))
                CardMethodRow(selected: true)
                if !error.isEmpty {
                    Text(error).font(.dx(14, .medium)).foregroundStyle(Color.danger).frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12).background(RoundedRectangle(cornerRadius: 14).fill(Color.dangerSoft)).padding(.top, 16)
                }
            }
            BottomBar {
                DXButton(size: .lg, busy: busy, disabled: !agreed, action: pay) {
                    Text(t("Pay")) + Text(" ") + aed(quote.total, size: 16, weight: .semibold)
                }
            }
        }
        .background(Color.bg)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $terms) { NavigationStack { LegalPage(id: "terms") } }
        .fullScreenCover(item: $page) { p in
            PaymentView(url: p.url) { id in
                page = nil
                Task { @MainActor in
                    if let id { _ = await store.confirmPayment(id) } else { await store.refresh() }
                    finish()
                }
            }
        }
    }

    private func pay() {
        busy = true; error = ""
        Task { @MainActor in
            do {
                let b = try await API.post("book", [
                    "modelId": quote.carId, "period": quote.period.rawValue, "qty": quote.qty, "pickup": quote.pickup,
                    "extras": quote.extras, "terms": agreed,
                ])
                reservationId = b["reservationId"].string
                await store.refresh()
                // "Pay at month end" customers: the booking is confirmed now and the invoice is collected later
                if b["payLater"].bool == true { finish(); return }
                if let invoiceId = b["invoiceId"].string, let rid = reservationId {
                    // the booking exists; if the payment cannot start, it can be paid later from the booking
                    if case .checkout(let url)? = try? await store.payInvoice(invoiceId, returnPath: "/confirmed/\(rid)") {
                        page = CheckoutPage(url: url)
                        return
                    }
                }
                finish()
            } catch {
                self.error = error.localizedDescription
                busy = false
            }
        }
    }

    private func finish() {
        busy = false
        if let id = reservationId { router.replace(with: .confirmed(id)) }
    }

    private func row(_ label: Text, _ value: Text) -> some View {
        HStack {
            label.foregroundStyle(Color.inkMuted)
            Spacer(minLength: 12)
            value.fontWeight(.medium).foregroundStyle(Color.ink)
        }
        .font(.dx(15))
        .padding(.horizontal, 16).padding(.vertical, 8).frame(minHeight: 52)
    }

    private func heading(_ s: String) -> some View {
        Text(s).font(.dx(16, .semibold)).foregroundStyle(Color.ink).padding(.top, 24).padding(.bottom, 8)
    }
}

/// Booking step 3 of 3.
struct ConfirmedView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    let id: String

    var body: some View {
        let b = store.bookings.first { $0.id == id }
        let unpaid = store.invoices.contains { $0.bookingId == id && $0.status == .pending }
        PageScroll {
            if let b {
                VStack(spacing: 0) {
                    Image(systemName: "checkmark.circle").font(.system(size: 80, weight: .light)).foregroundStyle(Color.brand)
                        .symbolEffect(.bounce, value: id).padding(.top, 64)
                    Text(unpaid ? t("Booking saved") : t("You're all set!")).font(.display(30)).foregroundStyle(Color.ink).padding(.top, 16)
                    Text(unpaid ? t("Your car is held. Pay the invoice to confirm it.") : t("Your booking is confirmed. We'll message you before pickup."))
                        .font(.dx(15)).foregroundStyle(Color.inkMuted).padding(.top, 4)
                    VStack(alignment: .leading, spacing: 4) {
                        RemoteImage(path: b.car.image).frame(height: 112).frame(maxWidth: .infinity)
                        Text(b.car.name).font(.dx(18, .bold)).foregroundStyle(Color.ink).padding(.top, 8)
                        HStack(spacing: 6) {
                            Text(Fmt.day(b.pickup))
                            Image(systemName: "arrow.right").font(.system(size: 12)).flipsForRightToLeftLayoutDirection(true)
                            Text(Fmt.day(b.dropoff))
                        }
                        .font(.dx(14)).foregroundStyle(Color.inkMuted)
                    }
                    .padding(16).card().padding(.top, 32)
                    DXButton(t("View booking"), size: .lg) {
                        router.tab = .bookings
                        router.paths[.bookings] = [.booking(id, section: nil)]
                        router.paths[.book] = []
                    }
                    .padding(.top, 24)
                    Button(t("Back to home")) { router.paths[.book] = []; router.select(.home) }
                        .font(.dx(16, .medium)).foregroundStyle(Color.brand).padding(.vertical, 12).padding(.top, 4)
                }
                .multilineTextAlignment(.center)
                .onAppear { Haptics.success() }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden()
    }
}
