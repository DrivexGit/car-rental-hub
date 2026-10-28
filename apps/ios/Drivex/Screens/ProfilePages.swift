import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Supabase

// The pages under Profile (apps/customer/src/screens/ProfilePages.tsx).

struct EditProfileView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var busy = false
    @State private var error = ""

    private var valid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2
            && email.trimmingCharacters(in: .whitespaces).range(of: #"^\S+@\S+\.\S+$"#, options: .regularExpression) != nil
    }

    var body: some View {
        InnerPage(title: t("Edit profile")) {
            PhotoPicker().padding(.bottom, 24)
            field(t("Full name"), $name)
            field(t("Email"), $email, ltr: true, keyboard: .emailAddress)
            field(t("Mobile number"), .constant(Fmt.phone(store.user?.phone)), ltr: true, disabled: true)
            ErrorText(message: error).padding(.bottom, 8)
            DXButton(t("Save"), size: .lg, busy: busy, disabled: !valid) {
                busy = true; error = ""
                Task { @MainActor in
                    do {
                        try await store.updateUser(name: name.trimmingCharacters(in: .whitespaces), email: email.trimmingCharacters(in: .whitespaces))
                        dismiss()
                    } catch { self.error = error.localizedDescription; busy = false }
                }
            }
            .padding(.top, 16)
        }
        .onAppear {
            name = store.user?.name ?? ""
            email = store.user?.email ?? ""
        }
    }

    private func field(_ label: String, _ value: Binding<String>, ltr: Bool = false, disabled: Bool = false, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.dx(14)).foregroundStyle(Color.inkMuted)
            TextField("", text: value)
                .font(.dx(16)).foregroundStyle(disabled ? Color.inkMuted : Color.ink)
                .keyboardType(keyboard).textInputAutocapitalization(ltr ? .never : .words).autocorrectionDisabled(ltr)
                .multilineTextAlignment(ltr && I18n.shared.lang.isRTL ? .trailing : .leading)
                .disabled(disabled)
                .padding(.horizontal, 16).frame(height: 56)
                .background(RoundedRectangle(cornerRadius: 12).fill(disabled ? Color.bg : .white))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
        }
        .padding(.bottom, 16)
    }
}

/// Tap the photo to pick one; it is cropped square and shrunk on the phone before upload.
private struct PhotoPicker: View {
    @Environment(AppStore.self) private var store
    @State private var item: PhotosPickerItem?
    @State private var busy = false
    @State private var error = ""
    @State private var choose = false
    @State private var camera = false
    @State private var library = false

    var body: some View {
        VStack(spacing: 12) {
            Button { choose = true } label: {
                Face(size: 96)
                    .overlay(alignment: .bottomTrailing) {
                        Group { if busy { ProgressView().tint(.white) } else { Image(systemName: "camera").font(.system(size: 14)) } }
                            .foregroundStyle(.white).frame(width: 36, height: 36)
                            .background(Circle().fill(Color.brand)).overlay(Circle().stroke(.white, lineWidth: 2))
                    }
            }
            .buttonStyle(.plain)
            .disabled(busy)
            .accessibilityLabel(t("Change profile photo"))
            if store.user?.avatarURL != nil {
                Button(t("Remove photo")) { run { try await store.setAvatar(nil) } }
                    .font(.dx(14, .medium)).underline().foregroundStyle(Color.inkMuted).disabled(busy)
            }
            ErrorText(message: error).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .confirmationDialog(t("Change profile photo"), isPresented: $choose) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) { Button(t("Take photo")) { camera = true } }
            Button(t("Photo library")) { library = true }
            Button(t("Cancel"), role: .cancel) {}
        }
        .photosPicker(isPresented: $library, selection: $item, matching: .images)
        .fullScreenCover(isPresented: $camera) { CameraPicker { img in upload(img) }.ignoresSafeArea() }
        .onChange(of: item) { _, it in
            guard let it else { return }
            item = nil
            run {
                guard let data = try await it.loadTransferable(type: Data.self), let img = UIImage(data: data) else {
                    throw AppError(t("We could not read that image. Try a JPG or PNG."))
                }
                guard let jpeg = ImageTools.squareJPEG(img) else { throw AppError(t("We could not read that image. Try a JPG or PNG.")) }
                try await store.setAvatar(jpeg)
            }
        }
    }

    private func upload(_ img: UIImage) {
        run {
            guard let jpeg = ImageTools.squareJPEG(img) else { throw AppError(t("We could not read that image. Try a JPG or PNG.")) }
            try await store.setAvatar(jpeg)
        }
    }

    private func run(_ fn: @escaping () async throws -> Void) {
        busy = true; error = ""
        Task { @MainActor in
            do { try await fn() } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

enum ImageTools {
    /// Centre-crops to a square and shrinks to `size` px, JPEG at 85% (the site's compressSquare).
    static func squareJPEG(_ image: UIImage, size: CGFloat = 512) -> Data? {
        let w = image.size.width * image.scale, h = image.size.height * image.scale
        let side = min(w, h), out = min(size, side)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: CGSize(width: out, height: out), format: format).image { _ in
            let scale = out / side
            image.draw(in: CGRect(x: -(w - side) / 2 * scale, y: -(h - side) / 2 * scale, width: w * scale, height: h * scale))
        }
        return img.jpegData(compressionQuality: 0.85)
    }
}

/// The camera, for a document or a profile photo.
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = .camera
        c.delegate = context.coordinator
        return c
    }
    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onImage(img) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

// MARK: - Payments

struct PaymentsView: View {
    @Environment(AppStore.self) private var store
    @State private var paying: Invoice?

    var body: some View {
        InnerPage(title: t("Payments")) {
            if store.invoices.isEmpty {
                EmptyState(icon: "doc.text", title: t("No payments yet"))
            } else {
                Divided {
                    ForEach(store.invoices) { i in
                        HStack(spacing: 12) {
                            Image(systemName: "doc.text").font(.system(size: 18)).foregroundStyle(Color.inkMuted)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(verbatim: i.number).font(.dx(15, .medium)).foregroundStyle(Color.ink)
                                Text(Fmt.day(i.paidAt ?? i.issued)).font(.dx(12)).foregroundStyle(Color.inkMuted)
                            }
                            Spacer(minLength: 4)
                            InvoiceButtons(invoice: i)
                            InvoiceStatus(invoice: i) { paying = i }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12).frame(minHeight: 64)
                    }
                }
                .card()
            }
            if !store.fines.isEmpty {
                Text(t("Salik & fines")).font(.dx(16, .semibold)).foregroundStyle(Color.ink).padding(.top, 24).padding(.bottom, 8)
                Divided {
                    ForEach(store.fines) { f in
                        HStack {
                            VStack(alignment: .leading, spacing: 0) {
                                Text(f.title.map { t($0) } ?? t(f.type == "traffic" ? "Fine" : "Salik")).font(.dx(15, .medium)).foregroundStyle(Color.ink)
                                Text((f.place.isEmpty ? "" : "\(f.place) · ") + Fmt.day(f.date)).font(.dx(12)).foregroundStyle(Color.inkMuted)
                            }
                            Spacer()
                            aed(f.amount, size: 15, weight: .semibold).foregroundStyle(Color.ink)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12).frame(minHeight: 56)
                    }
                }
                .card()
            }
        }
        .refreshable { await store.refresh() }
        .sheet(item: $paying) { PayInvoiceSheet(invoice: $0) }
    }
}

// MARK: - Documents

/// Uploads to the private customer-documents bucket ("<uid>/...") and registers the file for staff review; an AI check
/// rejects at once a picture that is unreadable, the wrong document or expired. Viewing an approved document needs a
/// code sent to WhatsApp (api/doc-view.ts); the unlock lasts five minutes and lives in memory only.
struct DocumentsView: View {
    @Environment(AppStore.self) private var store
    @State private var busy: String?
    @State private var error = ""
    @State private var choosing: String?
    @State private var askSource = false
    @State private var camera = false
    @State private var library = false
    @State private var files = false
    @State private var photo: PhotosPickerItem?
    @State private var unlock: (token: String, expires: Date)?
    @State private var viewing: (id: String, name: String)?
    @State private var showCode = false
    @State private var code = ""
    @State private var viewBusy = false
    @State private var viewError = ""
    @State private var opened: SharedFile?

    private let types: [(id: String, label: String)] = RequiredDocuments.all.map { ($0.id, $0.label) } + [("visa", "Visa page (tourists)")]

    var body: some View {
        InnerPage(title: t("Documents")) {
            Text(t("Upload once. We need these before your first pickup.")).font(.dx(15)).foregroundStyle(Color.inkMuted).padding(.bottom, 16)
            Divided {
                ForEach(types, id: \.id) { type in row(type.id, type.label) }
            }
            .card()
            ErrorText(message: error).padding(.top, 12)
        }
        .refreshable { await store.refresh() }
        .confirmationDialog(t("Photo or PDF"), isPresented: $askSource) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) { Button(t("Take photo")) { camera = true } }
            Button(t("Photo library")) { library = true }
            Button(t("Choose file")) { files = true }
            Button(t("Cancel"), role: .cancel) { choosing = nil }
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { img in
                guard let type = choosing, let data = img.jpegData(compressionQuality: 0.85) else { return }
                upload(type, data: data, name: "photo.jpg", mime: "image/jpeg")
            }
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $library, selection: $photo, matching: .images)
        .onChange(of: photo) { _, item in
            guard let item, let type = choosing else { return }
            photo = nil
            Task { @MainActor in
                guard let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data), let jpeg = img.jpegData(compressionQuality: 0.85) else {
                    error = t("We could not read that image. Try a JPG or PNG."); choosing = nil; return
                }
                upload(type, data: jpeg, name: "photo.jpg", mime: "image/jpeg")
            }
        }
        .fileImporter(isPresented: $files, allowedContentTypes: [.pdf, .image]) { result in
            guard let type = choosing else { return }
            switch result {
            case .success(let url):
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { error = t("Something went wrong. Please try again."); choosing = nil; return }
                let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                upload(type, data: data, name: url.lastPathComponent, mime: mime)
            case .failure:
                choosing = nil
            }
        }
        .sheet(isPresented: $showCode, onDismiss: { viewing = nil; code = ""; viewError = "" }) { codeSheet }
        .sheet(item: $opened) { f in
            SheetFrame(title: viewingName ?? t("Documents"), large: true) {
                HTMLView(url: f.url).clipShape(RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
            }
        }
    }

    @State private var viewingName: String?

    private func row(_ id: String, _ label: String) -> some View {
        let doc = store.documents.first { $0.type == id }
        let status = doc.map { d in d.status == "approved" ? t("Approved") : d.status == "rejected" ? t("Rejected — upload again") : t("In review") }
        return HStack(spacing: 12) {
            Button { Haptics.tap(); choosing = id; askSource = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "person.text.rectangle").font(.system(size: 18)).foregroundStyle(Color.ink)
                    VStack(alignment: .leading, spacing: 2) {
                        (Text(t(label)).font(.dx(15, .medium)).foregroundColor(.ink) + Text("  ") +
                         Text(id == "visa" ? t("Optional") : t("Required")).font(.dx(12)).foregroundColor(id == "visa" ? .inkMuted : .warnText))
                        Text(doc.map { "\($0.fileName) · \(status ?? "")" } ?? t("Photo or PDF")).font(.dx(12)).foregroundStyle(Color.inkMuted).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    if busy == id {
                        ProgressView().tint(Color.brand)
                    } else if let doc, doc.status != "rejected" {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(Color.brand)
                    } else {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 18)).foregroundStyle(Color.brand)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(busy != nil)
            if let doc, doc.status == "approved" {
                Button(t("View")) { view(doc.id, t(label)) }
                    .font(.dx(14, .medium)).foregroundStyle(Color.brand)
                    .padding(.horizontal, 12).padding(.vertical, 6).overlay(Capsule().stroke(Color.line))
                    .disabled(viewBusy)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12).frame(minHeight: 64)
    }

    private var codeSheet: some View {
        SheetFrame(title: viewing?.name ?? t("Documents")) {
            Text(t("We sent a code to your WhatsApp. Enter it to open this document.")).font(.dx(14)).foregroundStyle(Color.inkMuted).padding(.bottom, 12)
            TextField(t("Enter the code"), text: $code)
                .keyboardType(.numberPad).textContentType(.oneTimeCode)
                .font(.system(size: 20, weight: .semibold)).tracking(8).multilineTextAlignment(.center)
                .frame(height: 48).background(RoundedRectangle(cornerRadius: 12).fill(.white)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.line))
                .onChange(of: code) { _, v in let c = String(Fmt.asciiDigits(v).filter(\.isNumber).prefix(6)); if c != v { code = c } }
            ErrorText(message: viewError).padding(.top, 12)
            DXButton(t("Open document"), size: .lg, busy: viewBusy, disabled: code.count != 6) { checkCode() }.padding(.top, 16)
        }
    }

    private func upload(_ type: String, data: Data, name: String, mime: String) {
        guard let uid = store.user?.id else { return }
        if data.count > 10 * 1024 * 1024 { error = t("File is too large (max 10 MB)."); choosing = nil; return }
        busy = type; error = ""
        Task { @MainActor in
            defer { busy = nil; choosing = nil }
            let ext = (name as NSString).pathExtension.lowercased()
            let path = "\(uid)/\(type)-\(Int(Date().timeIntervalSince1970 * 1000)).\(ext.isEmpty ? "jpg" : ext)"
            do {
                _ = try await supabase.storage.from("customer-documents").upload(path, data: data, options: FileOptions(contentType: mime))
            } catch { self.error = error.localizedDescription; return }
            do {
                let me: [JSON] = try await supabase.from("customers").select("lead_id, tenant_id").eq("id", value: uid).limit(1).execute().value
                struct NewDoc: Encodable {
                    let lead_id: String?, tenant_id: String?, document_type: String, storage_bucket = "customer-documents", storage_path: String
                    let file_name: String, mime_type: String, file_size: Int, uploaded_by = "customer", verification_status = "pending"
                }
                let row: [JSON] = try await supabase.from("customer_documents")
                    .insert(NewDoc(lead_id: me.first?["lead_id"].string, tenant_id: me.first?["tenant_id"].string, document_type: type, storage_path: path,
                                   file_name: name, mime_type: mime, file_size: data.count))
                    .select("id").execute().value
                if let id = row.first?["id"].string, let check = try? await API.post("doc-check", ["documentId": id]),
                   check["status"].string == "rejected", let reason = check["reason"].text {
                    self.error = reason
                }
            } catch { self.error = error.localizedDescription }
            await store.refresh()
        }
    }

    private func view(_ id: String, _ name: String) {
        viewError = ""; code = ""; viewBusy = true
        Task { @MainActor in
            defer { viewBusy = false }
            do {
                if let u = unlock, u.expires > Date() { try await open(id, name: name, token: u.token); return }
                unlock = nil
                viewing = (id, name)
                showCode = true
                _ = try await API.post("doc-view", ["action": "send"])
            } catch {
                unlock = nil
                viewError = error.localizedDescription
            }
        }
    }

    private func checkCode() {
        guard let v = viewing else { return }
        viewBusy = true; viewError = ""
        Task { @MainActor in
            defer { viewBusy = false }
            do {
                let u = try await API.post("doc-view", ["action": "unlock", "code": code])
                guard let token = u["token"].string else { throw AppError(t("Please enter the code again.")) }
                unlock = (token, Date(timeIntervalSince1970: (u["expiresAt"].double ?? 0) / 1000))
                try await open(v.id, name: v.name, token: token)
            } catch { viewError = error.localizedDescription }
        }
    }

    private func open(_ id: String, name: String, token: String) async throws {
        let out = try await API.post("doc-view", ["action": "view", "documentId": id, "unlock": token])
        guard let s = out["url"].text, let url = URL(string: s) else { throw AppError(t("Could not open the document. Please try again.")) }
        if showCode { showCode = false; try? await Task.sleep(for: .milliseconds(450)) }
        viewingName = name
        opened = SharedFile(url: url)
    }
}

// MARK: - Security, notifications, language, legal, other

struct SecurityView: View {
    @Environment(AppStore.self) private var store
    var body: some View {
        InnerPage(title: t("Security")) {
            ListGroup {
                ListRow(icon: "iphone", label: t("Sign-in number"), value: Fmt.phone(store.user?.phone))
            }
            Text(t("You sign in with a one-time code sent to this number. To change it, contact support.")).font(.dx(14)).foregroundStyle(Color.inkMuted).padding(.horizontal, 4)
        }
    }
}

struct NotificationSettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var on = User.Notify(bookings: true, invoices: true, offers: true)

    var body: some View {
        InnerPage(title: t("Notifications")) {
            Divided {
                toggle("Booking reminders", \.bookings)
                toggle("Invoices, Salik & fines", \.invoices)
                toggle("Offers & benefits", \.offers)
            }
            .card()
        }
        .onAppear { if let n = store.user?.notify { on = n } }
    }

    private func toggle(_ label: String, _ key: WritableKeyPath<User.Notify, Bool>) -> some View {
        Toggle(isOn: Binding(get: { on[keyPath: key] }, set: { v in
            var next = on
            next[keyPath: key] = v
            let before = on
            on = next
            Task { @MainActor in
                do { try await store.updateUser(notify: next) } catch { on = before }
            }
        })) {
            Text(t(label)).font(.dx(16, .medium)).foregroundStyle(Color.ink)
        }
        .tint(Color.brand)
        .padding(.horizontal, 16).frame(height: 64)
    }
}

struct LanguageView: View {
    @State private var i18n = I18n.shared
    var body: some View {
        InnerPage(title: t("Language")) {
            Divided {
                ForEach(Lang.allCases) { l in
                    Button { Haptics.tap(); withAnimation { i18n.set(l) } } label: {
                        HStack {
                            Text(verbatim: l.label).font(.dx(16, l == i18n.lang ? .semibold : .regular))
                            Spacer()
                            if l == i18n.lang { Image(systemName: "checkmark").font(.system(size: 15, weight: .semibold)) }
                        }
                        .foregroundStyle(l == i18n.lang ? Color.brand : Color.ink)
                        .padding(.horizontal, 16).frame(height: 56)
                        .background(l == i18n.lang ? Color.brandSoft : .clear)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .card()
        }
    }
}

struct SupportLegalView: View {
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    var body: some View {
        InnerPage(title: t("Support & legal")) {
            ListGroup {
                ListRow(label: t("Chat with Drivex AI")) { router.openSupport() }
                ListRow(label: t("WhatsApp us")) { openURL(AppConfig.whatsappLink()) }
                ListRow(label: t("Terms & conditions")) { router.push(.terms) }
                ListRow(label: t("Privacy policy")) { router.push(.privacy) }
                ListRow(label: t("Delete my account")) { router.push(.deleteAccount) }
            }
        }
    }
}

struct OtherView: View {
    var body: some View {
        InnerPage(title: t("Other")) {
            ListGroup {
                ListRow(label: t("App version"), value: AppConfig.version)
            }
        }
    }
}
