package com.drivex.app

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import com.drivex.app.core.I18n
import com.drivex.app.core.Lang
import com.drivex.app.core.ThemeStore
import com.drivex.app.data.AppStore
import com.drivex.app.data.Booking
import com.drivex.app.data.BookingStatus
import com.drivex.app.data.Car
import com.drivex.app.data.Doc
import com.drivex.app.data.Fine
import com.drivex.app.data.Invoice
import com.drivex.app.data.InvoiceLine
import com.drivex.app.data.Note
import com.drivex.app.data.Notify
import com.drivex.app.data.Offer
import com.drivex.app.data.Period
import com.drivex.app.data.Quote
import com.drivex.app.data.Specs
import com.drivex.app.data.User
import com.drivex.app.ui.DrivexRoot
import com.drivex.app.ui.Route
import com.drivex.app.ui.Router
import com.drivex.app.ui.Tab
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.LocalDate

/**
 * Pictures of the real screens with sample data, drawn on the computer (no phone needed), to check the layout in
 * English and Persian. Run: ./gradlew testDebugUnitTest -Pscreens  -> PNG files in app/build/screens
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xxhdpi", application = android.app.Application::class)
class ScreensTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val out = File("build/screens").apply { mkdirs() }

    @Before fun setUp() {
        assumeTrue(System.getProperty("drivex.screens") == "true")
        val context = ApplicationProvider.getApplicationContext<android.app.Application>()
        I18n.init(context)
        ThemeStore.init(context)
        context.getSharedPreferences("drivex", 0).edit().putBoolean("drivex.onboarded", true).commit()
        sample()
    }

    private fun day(n: Long) = LocalDate.now().plusDays(n).toString()

    private fun sample() {
        val yaris = Car("toyota-yaris", "Toyota", "Yaris", 2024, "Economy", 120.0, 700.0, 2400.0, "/cars/toyota-yaris.webp", 5, listOf("v1", "v2"))
        val patrol = Car("nissan-patrol", "Nissan", "Patrol", 2024, "SUV", 450.0, 2800.0, 9000.0, "/cars/nissan-patrol.webp", 7, listOf("v3"))
        val gle = Car("mercedes-benz-gle-53", "Mercedes-Benz", "GLE 53", 2025, "Luxury", 900.0, 5600.0, 18000.0, "/cars/mercedes-benz-gle-53.webp", 5, listOf("v4"))
        val inv = Invoice("i1", "INV-1042", "b1", 1260.0, day(-2), "pending", null, "Car rental", null,
            listOf(InvoiceLine("Rental", 1155.0, 0.0, 0.05), InvoiceLine("Full coverage insurance", 105.0, 0.0, 0.0)), emptyList(), null)
        AppStore.fill(
            User("u1", "+971501234567", "Sara Ahmadi", null, 24459, "Iran", null, Notify(true, true, false)),
            listOf(yaris, patrol, gle),
            listOf(
                Booking("b1", patrol, "A 12345", Period.daily, day(-2) + "T10:00:00+04:00", day(3) + "T10:00:00+04:00", 2475.0, listOf("full_cover"), BookingStatus.ongoing, "confirmed"),
                Booking("b2", yaris, "K 55120", Period.weekly, day(9) + "T10:00:00+04:00", day(16) + "T10:00:00+04:00", 805.0, emptyList(), BookingStatus.upcoming, "confirmed"),
            ),
            listOf(inv),
            listOf(Fine("f1", "b1", "salik", null, 4.0, day(-1), "Al Garhoud Bridge")),
            listOf(
                Offer("o1", "car", "Mercedes-Benz GLE 53", null, 15, null, gle, null, null, null),
                Offer("o2", "partner", "Al Noor Restaurant", "Fine dining", 30, null, null, "Thirty percent off the menu.", "One visit per rental.", "Jumeirah"),
            ),
            listOf(Doc("d1", "id_card", "emirates-id.jpg", "approved", day(-20))),
            mapOf("nissan-patrol" to Specs("V8 5.6L", "Automatic", "Petrol", 7, 5, 4, listOf("Apple CarPlay", "360 camera"), null, emptyList())),
            listOf(Note("n1", "invoice", "New invoice INV-1042", "AED 1,260 for your Nissan Patrol", "/bookings/b1", false, day(0) + "T08:00:00+04:00")),
        )
    }

    private fun shot(name: String, lang: Lang = Lang.en, setup: () -> Unit) {
        I18n.set(lang)
        Router.reset()
        setup()
        compose.setContent { DrivexRoot() }
        compose.mainClock.advanceTimeBy(6000) // past the splash
        compose.waitForIdle()
        // the activity's window drawn into a bitmap (the test rule's own capture waits for a GPU frame Robolectric never sends)
        val view = compose.activity.window.decorView
        val bmp = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        compose.runOnUiThread { view.draw(android.graphics.Canvas(bmp)) }
        File(out, "$name-${lang.name}.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun home() = shot("1-home") {}
    @Test fun homeFa() = shot("1-home", Lang.fa) {}
    @Test fun book() = shot("2-book") { Router.tab = Tab.book }
    @Test fun reserve() = shot("3-reserve") { Router.tab = Tab.book; Router.push(Route.Reserve("nissan-patrol", Period.daily, 0, null, null)) }
    @Test fun reserveFa() = shot("3-reserve", Lang.fa) { Router.tab = Tab.book; Router.push(Route.Reserve("nissan-patrol", Period.daily, 0, null, null)) }
    @Test fun checkout() = shot("4-checkout") {
        Router.tab = Tab.book
        Router.push(Route.Checkout(Quote.of(AppStore.car("nissan-patrol")!!, Period.daily, 3, day(1), listOf("full_cover"))))
    }
    @Test fun bookings() = shot("5-bookings") { Router.tab = Tab.bookings }
    @Test fun bookingDetail() = shot("6-booking") { Router.tab = Tab.bookings; Router.push(Route.BookingDetail("b1")) }
    @Test fun support() = shot("7-support") { Router.tab = Tab.support }
    @Test fun profile() = shot("8-profile") { Router.tab = Tab.profile }
    @Test fun profileFa() = shot("8-profile", Lang.fa) { Router.tab = Tab.profile }
    @Test fun documents() = shot("9-documents") { Router.tab = Tab.profile; Router.push(Route.Documents) }
    @Test fun inbox() = shot("10-inbox") { Router.tab = Tab.home; Router.push(Route.Inbox) }
}
