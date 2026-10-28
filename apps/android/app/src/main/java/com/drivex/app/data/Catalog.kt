package com.drivex.app.data

import com.drivex.app.R
import com.drivex.app.core.Fmt
import com.drivex.app.core.J
import com.drivex.app.core.t

// Fleet helpers and marketing content, as on the site (apps/customer/src/data/catalog.ts).
object Catalog {
    fun slug(make: String, model: String) = "$make-$model".lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
    /** The studio picture the site ships for each model (/cars/<slug>.webp). */
    fun carImage(make: String, model: String) = "/cars/${slug(make, model)}.webp"

    private val sevenSeats = Regex("Patrol|Fortuner|Santa|Captiva|M8|Tahoe|Land Cruiser")

    /** Groups the vehicles table (one row per plate) into bookable models. Rows without a daily price are not for rent. */
    fun fleet(rows: List<J>): List<Car> {
        val by = LinkedHashMap<String, Car>()
        for (v in rows) {
            val daily = v["daily_price"].double ?: continue
            if (daily <= 0) continue
            val vid = v["id"].string ?: continue
            val make = v["make"].string ?: ""
            val model = v["model"].string ?: ""
            val id = slug(make, model)
            val c = by[id]
            if (c != null) { by[id] = c.copy(vehicleIds = c.vehicleIds + vid); continue }
            by[id] = Car(
                id, make, model, v["year"].int ?: 0, v["categories"].array.firstOrNull()?.string ?: "Car",
                daily, v["weekly_price"].double ?: daily * 7, v["monthly_price"].double ?: daily * 30,
                carImage(make, model), if (sevenSeats.containsMatchIn(model)) 7 else 5, listOf(vid),
            )
        }
        return by.values.toList()
    }

    /** Home carousel (content, not data). [period] is where the button goes on the Book tab. */
    data class Banner(val kicker: String, val title: String, val text: String, val cta: String, val image: Int, val period: Period?)
    val banners = listOf(
        Banner("Exclusive renter benefits", "A little more luxury.", "Enjoy 30% off at Al Noor Restaurant.", "Explore benefit", R.drawable.banner_luxury, null),
        Banner("Monthly plans", "Drive more, pay less.", "Save up to 40% with a monthly rental.", "See monthly cars", R.drawable.banner_monthly, Period.monthly),
    )
}

/** Days until the return (ongoing), days late (overdue) or days until pickup (upcoming); nothing for other statuses.
 *  Same wording and UAE-day counting as the site (src/lib/bookingTime.ts). */
fun timeLabel(b: Booking): Pair<String, Boolean>? = when (b.status) {
    BookingStatus.ongoing, BookingStatus.overdue -> {
        val left = Fmt.daysUntil(b.dropoff)
        if (left < 0 || b.status == BookingStatus.overdue) {
            val n = maxOf(1, -left)
            (if (n == 1) t("{n} day overdue", "n" to n) else t("{n} days overdue", "n" to n)) to true
        } else (if (left == 0) t("Due today") else if (left == 1) t("{n} day left", "n" to left) else t("{n} days left", "n" to left)) to false
    }
    BookingStatus.upcoming -> {
        val n = Fmt.daysUntil(b.pickup)
        (if (n <= 0) t("Starts today") else if (n == 1) t("Starts tomorrow") else t("Starts in {n} days", "n" to n)) to false
    }
    else -> null
}

/** "3 days" / "1 week" / "2 months", translated. */
fun periodCount(period: Period, n: Int): String = when (period) {
    Period.daily -> if (n == 1) t("{n} day", "n" to n) else t("{n} days", "n" to n)
    Period.weekly -> if (n == 1) t("{n} week", "n" to n) else t("{n} weeks", "n" to n)
    Period.monthly -> if (n == 1) t("{n} month", "n" to n) else t("{n} months", "n" to n)
}

/** Where a notification takes the customer: the page it links to, at the part it is about (src/data/notifications.ts). */
fun noteLink(type: String, link: String?): String {
    val to = link?.takeIf { it.isNotEmpty() } ?: "/"
    if (!Regex("^/bookings/[^/#?]+$").matches(to)) return to
    return when (type) { "fine" -> "$to#fines"; "invoice" -> "$to#invoice"; else -> to }
}
