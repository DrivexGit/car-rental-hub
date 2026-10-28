package com.drivex.app.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.drivex.app.core.Api
import com.drivex.app.core.AppConfig
import com.drivex.app.core.AppError
import com.drivex.app.core.Auth
import com.drivex.app.core.Db
import com.drivex.app.core.Fmt
import com.drivex.app.core.NotificationFeed
import com.drivex.app.core.Storage
import com.drivex.app.core.t
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant

/**
 * Everything the signed-in customer sees, loaded the same way as the site's store (apps/customer/src/lib/store.tsx):
 * the same tables, columns and filters, so the app and the site always show the same thing. Compose state.
 */
object AppStore {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var ready by mutableStateOf(false); private set
    var user by mutableStateOf<User?>(null); private set
    var fleet by mutableStateOf(emptyList<Car>()); private set
    var bookings by mutableStateOf(emptyList<Booking>()); private set
    var invoices by mutableStateOf(emptyList<Invoice>()); private set
    var fines by mutableStateOf(emptyList<Fine>()); private set
    var offers by mutableStateOf(emptyList<Offer>()); private set
    var documents by mutableStateOf(emptyList<Doc>()); private set
    var specs by mutableStateOf(emptyMap<String, Specs>()); private set
    var notes by mutableStateOf(emptyList<Note>()); private set
    var seller by mutableStateOf<Seller?>(null); private set
    /** The last load failed (no connection): the screens keep the previous data and say so. */
    var offline by mutableStateOf(false); private set

    val unreadCount get() = notes.count { !it.read }
    val missingDocuments get() = RequiredDocuments.missing(documents)
    fun car(id: String) = fleet.firstOrNull { it.id == id }

    private val loading = Mutex()
    private var feed: NotificationFeed? = null
    private var feedFor: String? = null

    fun refreshLater() { scope.launch { refresh() } }

    suspend fun refresh() = loading.withLock {
        try {
            val out = if (Auth.userId == null) null else loadAll()
            if (out == null) clear() else apply(out)
            offline = false
        } catch (e: Exception) {
            offline = true // keep what is on screen
        }
        ready = true
        followNotifications()
    }

    private fun clear() {
        user = null; fleet = emptyList(); bookings = emptyList(); invoices = emptyList(); fines = emptyList(); offers = emptyList()
        documents = emptyList(); specs = emptyMap(); notes = emptyList(); seller = null
    }

    private class Loaded(
        val user: User, val fleet: List<Car>, val bookings: List<Booking>, val invoices: List<Invoice>, val fines: List<Fine>,
        val offers: List<Offer>, val documents: List<Doc>, val specs: Map<String, Specs>, val notes: List<Note>, val seller: Seller?,
    )

    private fun apply(d: Loaded) {
        user = d.user; fleet = d.fleet; bookings = d.bookings; invoices = d.invoices; fines = d.fines; offers = d.offers
        documents = d.documents; specs = d.specs; notes = d.notes; seller = d.seller
    }

    private suspend fun loadAll(): Loaded? = coroutineScope {
        val uid = Auth.userId ?: return@coroutineScope null
        val c = async { Db.select("customers", "select" to "*", "id" to "eq.$uid", "limit" to "1") }
        val v = async { Db.select("vehicles", "select" to "id,make,model,year,categories,daily_price,weekly_price,monthly_price", "status" to "neq.unavailable") }
        val r = async {
            Db.select("reservations",
                "select" to "id,status,start_datetime,end_datetime,rental_period,extras,total_amount,vehicles(id,make,model,year,categories,plate_number,daily_price,weekly_price,monthly_price)",
                "customer_id" to "eq.$uid", "order" to "start_datetime.desc")
        }
        // invoices folded into a monthly one are shown through that one
        val i = async {
            Db.select("invoices", "select" to "*,invoice_items(description,amount,discount,vat_rate,sort),payments(amount,provider,category,created_at,status)",
                "consolidated_into" to "is.null", "order" to "issued_at.desc")
        }
        val f = async { Db.select("fines", "select" to "*", "order" to "occurred_at.desc") }
        val o = async { Db.select("offers", "select" to "*", "order" to "sort_order") }
        val d = async { Db.select("customer_documents", "select" to "id,document_type,file_name,verification_status,created_at", "order" to "created_at.desc") }
        val sp = async { Db.select("vehicle_model_specs", "select" to "*") }
        val nt = async { Db.select("notifications", "select" to "*", "audience" to "eq.customer", "order" to "created_at.desc", "limit" to "50") }

        val me = c.await().firstOrNull() ?: return@coroutineScope null // a staff account or a half-created customer
        // the seller's TRN and bank details, so the invoice in the app matches the one the panel prints
        val sellerRow = runCatching {
            Db.select("tenants", "select" to "trn,legal_address,bank_account_name,bank_name,iban,bic", "id" to "eq.${me["tenant_id"].string}", "limit" to "1").firstOrNull()
        }.getOrNull()

        val specs = sp.await().associate { x ->
            Catalog.slug(x["make"].string ?: "", x["model"].string ?: "") to Specs(
                x["engine"].text, x["transmission"].string ?: "", x["fuel"].string ?: "", x["seats"].int ?: 5, x["doors"].int ?: 4, x["bags"].int ?: 2,
                x["features"].array.mapNotNull { it.string }, x["image_url"].text, x["gallery"].array.mapNotNull { it.string },
            )
        }
        // Photos managed in the panel ("Car photos") win over the bundled /cars/ images.
        val fleet = Catalog.fleet(v.await()).map { car -> specs[car.id]?.let { s -> car.copy(seats = s.seats, image = s.image ?: car.image) } ?: car }

        val bookings = r.await().map { x ->
            val veh = x["vehicles"]
            val vid = veh["id"].string ?: ""
            val make = veh["make"].string ?: ""
            val model = veh["model"].string ?: ""
            val car = fleet.firstOrNull { vid in it.vehicleIds } ?: Catalog.fleet(listOf(veh)).firstOrNull() ?: Car(
                vid, make, model, veh["year"].int ?: 0, veh["categories"].array.firstOrNull()?.string ?: "Car", 0.0, 0.0, 0.0,
                Catalog.carImage(make, model), 5, listOf(vid),
            )
            val start = x["start_datetime"].string ?: ""
            val end = x["end_datetime"].string ?: ""
            val raw = x["status"].string ?: ""
            Booking(
                x["id"].string ?: "", car, veh["plate_number"].string ?: "",
                runCatching { Period.valueOf(x["rental_period"].text ?: "daily") }.getOrDefault(Period.daily),
                start, end, x["total_amount"].double ?: 0.0, x["extras"].array.mapNotNull { it.string }, status(raw, start, end), raw,
            )
        }

        val invoices = i.await().map { x ->
            Invoice(
                x["id"].string ?: "", x["number"].string ?: "", x["reservation_id"].text, x["amount"].double ?: 0.0, x["issued_at"].string ?: "",
                x["status"].string ?: "pending", x["paid_at"].text, x["description"].text, x["due_date"].text,
                x["invoice_items"].array.sortedBy { it["sort"].double ?: 0.0 }
                    .map { l -> InvoiceLine(l["description"].string ?: "", l["amount"].double ?: 0.0, l["discount"].double ?: 0.0, l["vat_rate"].double ?: 0.0) },
                x["payments"].array.filter { it["status"].string == "succeeded" }
                    .map { p -> InvoicePayment(p["created_at"].string ?: "", method(p["provider"].string), p["category"].text, p["amount"].double ?: 0.0) },
                x["file_path"].text,
            )
        }

        val byTitle = { title: String -> fleet.firstOrNull { "${it.make} ${it.model}".equals(title, ignoreCase = true) } }
        val offers = o.await().mapNotNull { x ->
            val kind = x["kind"].string ?: "partner"
            val title = x["title"].string ?: ""
            val car = if (kind == "car") byTitle(title) else null
            if (kind == "car" && car == null) null
            else Offer(x["id"].string ?: "", kind, title, x["subtitle"].text, x["discount_pct"].int ?: 0, x["image_url"].text, car,
                x["description"].text, x["terms"].text, x["location"].text)
        }

        Loaded(
            user = User(
                uid, me["phone"].string ?: "", me["full_name"].string ?: "", me["email"].text, me["customer_no"].int, me["nationality"].text,
                me["avatar_url"].text, Notify(me["notify_bookings"].bool ?: true, me["notify_invoices"].bool ?: true, me["notify_offers"].bool ?: true),
            ),
            fleet = fleet, bookings = bookings, invoices = invoices,
            fines = f.await().map { x ->
                Fine(x["id"].string ?: "", x["reservation_id"].text, x["type"].string ?: "", x["title"].text, x["amount"].double ?: 0.0,
                    x["occurred_at"].string ?: "", x["location"].string ?: "")
            },
            offers = offers,
            documents = d.await().map { x ->
                Doc(x["id"].string ?: "", x["document_type"].string ?: "", x["file_name"].string ?: "", x["verification_status"].string ?: "", x["created_at"].string ?: "")
            },
            specs = specs,
            notes = nt.await().map { x ->
                Note(x["id"].string ?: "", x["type"].string ?: "", x["title"].string ?: "", x["body"].text, x["link"].text, !x["read_at"].isNull, x["created_at"].string ?: "")
            },
            seller = sellerRow?.let { s -> Seller(s["trn"].text, s["legal_address"].text, s["bank_account_name"].text, s["bank_name"].text, s["iban"].text, s["bic"].text) },
        )
    }

    /** Fills the store with sample data for the screen pictures (ScreensTest). Not used by the app. */
    @androidx.annotation.VisibleForTesting
    internal fun fill(
        user: User, fleet: List<Car>, bookings: List<Booking>, invoices: List<Invoice>, fines: List<Fine>, offers: List<Offer>,
        documents: List<Doc>, specs: Map<String, Specs>, notes: List<Note>,
    ) {
        apply(Loaded(user, fleet, bookings, invoices, fines, offers, documents, specs, notes, null))
        ready = true
    }

    private fun status(raw: String, start: String, end: String): BookingStatus {
        if (raw == "pending" || raw == "draft") return BookingStatus.pending
        if (raw == "completed") return BookingStatus.completed
        if (raw == "cancelled") return BookingStatus.cancelled
        val now = Instant.now()
        if (now < Fmt.instant(start)) return BookingStatus.upcoming
        return if (now <= Fmt.instant(end)) BookingStatus.ongoing else BookingStatus.overdue
    }

    private fun method(provider: String?) = when (provider) {
        "stripe" -> "Card (Stripe)"
        "ziina" -> "Card (Ziina)"
        "manual" -> "Cash / bank transfer"
        else -> "Test payment"
    }

    /** A new invoice, fine or booking notification reloads the data, as on the site. */
    private fun followNotifications() {
        val id = user?.id
        if (id == feedFor) return
        feedFor = id
        feed?.stop(); feed = null
        if (id != null) feed = NotificationFeed(id) { refreshLater() }.also { it.start() }
    }

    // ---- actions

    suspend fun signOut() {
        Auth.signOut()
        refresh()
    }

    suspend fun markNotesRead() {
        if (notes.none { !it.read }) return
        runCatching { Db.update("notifications", mapOf("read_at" to Instant.now().toString()), "audience" to "eq.customer", "read_at" to "is.null") }
        notes = notes.map { it.copy(read = true) }
    }

    suspend fun updateUser(name: String? = null, email: String? = null, notify: Notify? = null) {
        val id = user?.id ?: return
        val patch = buildMap<String, Any?> {
            if (name != null) put("full_name", name)
            if (email != null) put("email", email.ifEmpty { null })
            if (notify != null) { put("notify_bookings", notify.bookings); put("notify_invoices", notify.invoices); put("notify_offers", notify.offers) }
        }
        Db.update("customers", patch, "id" to "eq.$id")
        refresh()
    }

    /** One file per customer (avatars/<id>/avatar.jpg); the stored URL carries a version so caches refresh. */
    suspend fun setAvatar(jpeg: ByteArray?) {
        val uid = user?.id ?: return
        if (jpeg != null) {
            val path = "$uid/avatar.jpg"
            try { Storage.upload("avatars", path, jpeg, "image/jpeg", upsert = true) } catch (e: Exception) { throw AppError(t("Could not upload your photo. Please try again.")) }
            val url = Storage.publicUrl("avatars", path) + "?v=${System.currentTimeMillis()}"
            try { Db.update("customers", mapOf("avatar_url" to url), "id" to "eq.$uid") } catch (e: Exception) { throw AppError(t("Could not save your photo. Please try again.")) }
            runCatching { Storage.remove("avatars", listOf("$uid/avatar.webp")) } // left over from the site
        } else {
            Db.update("customers", mapOf("avatar_url" to null), "id" to "eq.$uid")
            runCatching { Storage.remove("avatars", listOf("$uid/avatar.webp", "$uid/avatar.jpg")) }
        }
        refresh()
    }

    sealed interface PayStart { data class Checkout(val url: String) : PayStart; data object Paid : PayStart }

    /** Starts paying an invoice: a Stripe Checkout page to open, or (test setups only) paid at once.
     *  [returnPath] is the site page Stripe sends the customer back to; the app catches it (see PaymentScreen). */
    suspend fun payInvoice(id: String, returnPath: String): PayStart {
        val out = Api.post("pay", mapOf("invoiceId" to id, "returnUrl" to AppConfig.siteUrl + returnPath))
        out["url"].text?.let { return PayStart.Checkout(it) }
        refresh()
        return PayStart.Paid
    }

    /** Back from the Stripe page: confirms the payment with the provider, then reloads. */
    suspend fun confirmPayment(paymentId: String): Boolean {
        val out = runCatching { Api.post("pay", mapOf("action" to "confirm", "paymentId" to paymentId)) }.getOrNull()
        refresh()
        return out?.get("paid")?.bool ?: false
    }

    suspend fun extend(bookingId: String, days: Int) {
        Api.post("extend", mapOf("reservationId" to bookingId, "days" to days))
        refresh()
    }

}
