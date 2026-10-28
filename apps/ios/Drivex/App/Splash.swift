import SwiftUI

/// Animated launch screen, as on the site: road lines rush past, the D mark sweeps in, the wordmark reveals,
/// then the green closes into a circle. It waits for the data, but never longer than five seconds.
/// The system launch screen (Info.plist UILaunchScreen) is the same green with the mark, so there is no flash.
struct SplashView: View {
    let ready: Bool
    let onDone: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var markIn = false
    @State private var shine = false
    @State private var wordIn = false
    @State private var tagIn = false
    @State private var minDone = false
    @State private var closing = false
    @State private var roads = false

    var body: some View {
        GeometryReader { g in
            ZStack {
                Color.brand
                if !reduce {
                    ForEach(0..<3) { i in
                        Capsule().fill(.white.opacity(0.15)).frame(width: 160, height: 2)
                            .position(x: roads ? g.size.width * 1.4 : -g.size.width * 0.4, y: g.size.height * (0.36 + Double(i) * 0.14))
                            .animation(.easeIn(duration: 1.1).delay(0.15 * Double(i)).repeatForever(autoreverses: false), value: roads)
                    }
                }
                VStack(spacing: 0) {
                    Image("AppMark").resizable().frame(width: 96, height: 96)
                        .overlay {
                            LinearGradient(colors: [.clear, .white.opacity(0.4), .clear], startPoint: .leading, endPoint: .trailing)
                                .offset(x: shine ? 120 : -120)
                                .opacity(shine ? 0 : 1)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 28))
                        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.1)))
                        .shadow(color: .black.opacity(0.3), radius: 20, y: 10)
                        .offset(x: markIn || reduce ? 0 : -140)
                        .opacity(markIn || reduce ? 1 : 0)
                    Text(verbatim: "Drivex").font(.system(size: 40, weight: .heavy)).tracking(-0.5).foregroundStyle(.white)
                        .mask(alignment: .leading) { Rectangle().scaleEffect(x: wordIn || reduce ? 1 : 0, anchor: .leading) }
                        .padding(.top, 24)
                        .environment(\.layoutDirection, .leftToRight)
                    Text(t("Drive. Easy.").uppercased()).font(.dx(12, .medium)).tracking(4).foregroundStyle(.white.opacity(0.6))
                        .padding(.top, 12)
                        .opacity(tagIn || reduce ? 1 : 0)
                        .offset(y: tagIn || reduce ? 0 : 8)
                }
                .position(x: g.size.width / 2, y: g.size.height * 0.46)
            }
            .mask {
                Circle()
                    .frame(width: closing ? 0 : hypot(g.size.width, g.size.height) * 1.5, height: closing ? 0 : hypot(g.size.width, g.size.height) * 1.5)
                    .position(x: g.size.width / 2, y: g.size.height * 0.46)
            }
        }
        .ignoresSafeArea()
        .accessibilityElement()
        .accessibilityLabel("Drivex")
        .task {
            roads = true
            withAnimation(.spring(response: 0.6, dampingFraction: 0.6).delay(0.15)) { markIn = true }
            withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.7).delay(0.55)) { wordIn = true }
            withAnimation(.easeInOut(duration: 0.8).delay(0.75)) { shine = true }
            withAnimation(.easeOut(duration: 0.4).delay(1.05)) { tagIn = true }
            try? await Task.sleep(for: .seconds(reduce ? 0.6 : 1.9))
            minDone = true
            close()
            try? await Task.sleep(for: .seconds(3.1)) // gives up after five seconds even if the data is slow
            close(force: true)
        }
        .onChange(of: ready) { close() }
    }

    private func close(force: Bool = false) {
        guard !closing, force || (minDone && ready) else { return }
        withAnimation(.timingCurve(0.7, 0, 0.3, 1, duration: reduce ? 0.25 : 0.6)) { closing = true }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(reduce ? 0.25 : 0.6))
            onDone()
        }
    }
}

/// Three short slides on the first launch after sign-in. Skippable, shown once per device.
struct OnboardingView: View {
    @AppStorage("drivex.onboarded") private var seen = false
    @State private var index = 0

    private let slides: [(icon: String, title: String, text: String)] = [
        ("car.side", "Book in a minute", "Pick a car, choose your dates and pay. That's it."),
        ("list.clipboard", "Everything in one place", "Your bookings, invoices, Salik and fines, always up to date."),
        ("headphones", "Help when you need it", "Chat with Drivex AI any time, or call us if it's urgent."),
    ]

    var body: some View {
        if !seen {
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button(t("Skip")) { finish() }.font(.dx(14, .medium)).foregroundStyle(Color.inkMuted).frame(height: 40).padding(.horizontal, 8)
                }
                .padding(.horizontal, 24).padding(.top, 16)

                TabView(selection: $index) {
                    ForEach(slides.indices, id: \.self) { i in
                        VStack(spacing: 0) {
                            Image(systemName: slides[i].icon).font(.system(size: 52, weight: .light)).foregroundStyle(.white)
                                .frame(width: 112, height: 112)
                                .background(RoundedRectangle(cornerRadius: 32).fill(Color.brand))
                                .padding(.bottom, 32)
                            Text(t(slides[i].title)).font(.dx(28, .bold)).foregroundStyle(Color.ink)
                            Text(t(slides[i].text)).font(.dx(16)).foregroundStyle(Color.inkMuted).frame(maxWidth: 300).padding(.top, 12)
                        }
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                HStack(spacing: 8) {
                    ForEach(slides.indices, id: \.self) { k in
                        Capsule().fill(k == index ? Color.brand : Color.inkFaint.opacity(0.4)).frame(width: k == index ? 24 : 6, height: 6)
                    }
                }
                .animation(.spring(response: 0.3), value: index)
                .padding(.bottom, 24)
                DXButton(index == slides.count - 1 ? t("Get started") : t("Next"), size: .lg, arrow: true) {
                    if index == slides.count - 1 { finish() } else { withAnimation { index += 1 } }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
            .background(Color.bg.ignoresSafeArea())
            .transition(.opacity)
            .accessibilityAddTraits(.isModal)
        }
    }

    private func finish() { withAnimation(.easeOut(duration: 0.25)) { seen = true } }
}
