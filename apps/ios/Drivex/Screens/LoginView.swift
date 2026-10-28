import SwiftUI
import Supabase

/// Sign in with a UAE mobile number and a one-time code; new customers add their name once (api/auth.ts).
struct LoginView: View {
    let open: (Route) -> Void
    private enum Step { case phone, code, name }

    @State private var step: Step = .phone
    @State private var phone = ""
    @State private var code = ""
    @State private var name = ""
    @State private var timer = 0
    @State private var busy = false
    @State private var error = ""
    @State private var testMode = false
    @FocusState private var focused: Bool

    private var national: String {
        let digits = Fmt.asciiDigits(phone).filter(\.isNumber)
        for p in ["00971", "971", "0"] where digits.hasPrefix(p) { return String(digits.dropFirst(p.count)) }
        return digits
    }
    private var full: String { "+971\(national)" }
    private var phoneOk: Bool { national.count == 9 && national.hasPrefix("5") }
    /// Only warn once the number is clearly not a UAE mobile, not while the customer is still typing.
    private var phoneHint: String {
        !national.isEmpty && (!national.hasPrefix("5") || national.count > 9) ? t("Enter a UAE mobile number, e.g. 50 123 4567.") : ""
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.night.ignoresSafeArea()
            GeometryReader { g in
                Image("LoginBackground").resizable().scaledToFill()
                    .frame(width: g.size.width, height: g.size.height * 0.7, alignment: .top).clipped()
                    .overlay(LinearGradient(stops: [.init(color: .black.opacity(0.3), location: 0), .init(color: .clear, location: 0.5), .init(color: Color.night, location: 1)], startPoint: .top, endPoint: .bottom))
            }
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                header.frame(height: 64)
                Spacer(minLength: 24)
                Group {
                    switch step {
                    case .phone: phoneStep
                    case .code: codeStep
                    case .name: nameStep
                    }
                }
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
                .padding(.bottom, 40)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
            .foregroundStyle(.white)
        }
        .animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.35), value: step)
        .task(id: timer) {
            guard timer > 0 else { return }
            try? await Task.sleep(for: .seconds(1))
            timer -= 1
        }
    }

    @ViewBuilder private var header: some View {
        if step == .phone {
            Image("LogoWhite").resizable().scaledToFit().frame(height: 32).accessibilityLabel("Drivex")
        } else {
            Button { error = ""; step = step == .name ? .code : .phone } label: {
                Image(systemName: "arrow.left").font(.system(size: 17, weight: .medium)).flipsForRightToLeftLayoutDirection(true)
                    .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1))).overlay(Circle().stroke(.white.opacity(0.2)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(t("Back"))
        }
    }

    private func panel<Content: View>(_ title: String, sub: Text, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.display(34)).fixedSize(horizontal: false, vertical: true)
            sub.font(.dx(15)).foregroundStyle(.white.opacity(0.75)).padding(.top, 8).padding(.bottom, 28)
            content()
        }
    }

    private var phoneStep: some View {
        panel(t("Welcome to Drivex"), sub: Text(t("Enter your mobile number to sign in or create your account."))) {
            Text(t("Mobile number")).font(.dx(14, .medium)).foregroundStyle(.white.opacity(0.7)).padding(.bottom, 8)
            HStack(spacing: 12) {
                Text(verbatim: "🇦🇪 +971").font(.dx(17, .semibold)).foregroundStyle(Color.ink)
                Rectangle().fill(Color.line).frame(width: 1, height: 28)
                TextField("50 123 4567", text: $phone)
                    .font(.dx(18)).foregroundStyle(Color.ink).tint(Color.brand)
                    .keyboardType(.phonePad).textContentType(.telephoneNumber)
                    .focused($focused)
                    .onSubmit { if phoneOk { sendCode() } }
            }
            .padding(.horizontal, 16)
            .frame(height: 56)
            .background(RoundedRectangle(cornerRadius: 12).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(focused ? Color.brand : Color.line))
            .environment(\.layoutDirection, .leftToRight)
            loginError(error.isEmpty ? phoneHint : error)
            DXButton(t("Send code"), size: .lg, busy: busy, disabled: !phoneOk) { sendCode() }.padding(.top, 24)
            Text(t("By continuing you agree to our Terms and Privacy Policy.")).font(.dx(12)).foregroundStyle(.white.opacity(0.5))
                .frame(maxWidth: .infinity).multilineTextAlignment(.center).padding(.top, 16)
            HStack(spacing: 16) {
                Button(t("Terms & conditions")) { open(.terms) }
                Button(t("Privacy policy")) { open(.privacy) }
            }
            .font(.dx(12)).foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity).padding(.top, 8)
        }
        .onAppear { focused = true }
    }

    private var codeStep: some View {
        panel(t("Enter the code"), sub: Text(t("We sent a 6-digit code by SMS to")) + Text(" ") + Text(verbatim: Fmt.phone(full)).bold().foregroundColor(.white)) {
            CodeField(code: $code) { if $0.count == 6 { verify($0) } }
            if testMode {
                Text(t("Test mode: SMS is not connected yet.") + " " + t("Use code {code}", ["code": "123456"]))
                    .font(.dx(14)).foregroundStyle(Color.warnText)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.warnSoft)).padding(.top, 12)
            }
            loginError(error)
            DXButton(t("Continue"), size: .lg, busy: busy, disabled: code.count < 6) { verify(code) }.padding(.top, 24)
            Button(timer > 0 ? t("Resend code in {n}s", ["n": timer]) : t("Resend code")) { sendCode() }
                .font(.dx(14, .medium)).foregroundStyle(.white.opacity(timer > 0 || busy ? 0.4 : 1))
                .disabled(timer > 0 || busy)
                .frame(maxWidth: .infinity).padding(.top, 16)
        }
    }

    private var nameStep: some View {
        panel(t("What's your name?"), sub: Text(t("So we know how to greet you. You only do this once."))) {
            TextField(t("Full name"), text: $name)
                .font(.dx(18)).foregroundStyle(Color.ink).tint(Color.brand)
                .textContentType(.name).focused($focused)
                .padding(.horizontal, 16).frame(height: 56)
                .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(focused ? Color.brand : Color.line))
                .onAppear { focused = true }
            loginError(error)
            DXButton(t("Get started"), size: .lg, busy: busy, disabled: name.trimmingCharacters(in: .whitespaces).count < 2) {
                verify(code, name: name.trimmingCharacters(in: .whitespaces))
            }
            .padding(.top, 24)
        }
    }

    private func loginError(_ msg: String) -> some View {
        Group {
            if !msg.isEmpty { Text(msg).font(.dx(14, .medium)).foregroundStyle(Color(red: 0.99, green: 0.65, blue: 0.65)).padding(.top, 12) }
        }
    }

    private func run(_ fn: @escaping () async throws -> Void) {
        busy = true; error = ""
        Task { @MainActor in
            do { try await fn() } catch { self.error = error.localizedDescription }
            busy = false
        }
    }

    private func sendCode() {
        run {
            let r = try await API.post("auth", ["action": "send", "phone": full])
            testMode = r["testMode"].bool ?? false
            code = ""
            step = .code
            timer = 45
        }
    }

    private func verify(_ c: String, name fullName: String? = nil) {
        run {
            var body: [String: Any] = ["action": "verify", "phone": full, "code": c]
            if let fullName { body["name"] = fullName }
            let r = try await API.post("auth", body)
            if r["needName"].bool == true { step = .name; return }
            guard let access = r["access_token"].text, let refresh = r["refresh_token"].text else { throw AppError(t("Something went wrong. Please try again.")) }
            _ = try await supabase.auth.setSession(accessToken: access, refreshToken: refresh)
            Haptics.success()
        }
    }
}

/// Six boxes over one hidden field, so the phone's "From Messages" code suggestion fills it in one tap.
private struct CodeField: View {
    @Binding var code: String
    let onChange: (String) -> Void
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            TextField("", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .foregroundStyle(.clear).tint(.clear)
                .accessibilityLabel(t("Verification code"))
                .onChange(of: code) { _, v in
                    let clean = String(Fmt.asciiDigits(v).filter(\.isNumber).prefix(6))
                    if clean != v { code = clean; return }
                    onChange(clean)
                }
            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { i in
                    let chars = Array(code)
                    Text(i < chars.count ? String(chars[i]) : "")
                        .font(.system(size: 24, weight: .bold)).foregroundStyle(Color.ink)
                        .frame(maxWidth: .infinity).frame(height: 56)
                        .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(i == chars.count && focused ? Color.brand : Color.line))
                }
            }
            .allowsHitTesting(false)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .onAppear { focused = true }
        .environment(\.layoutDirection, .leftToRight)
    }
}
