package com.drivex.app

import org.junit.Assert.assertEquals
import org.junit.Test

class LinkRouterTest {
    private val router = LinkRouter("https://drivex-customer.vercel.app")

    @Test fun `the site itself stays in the app`() {
        assertEquals(Route.IN_APP, router.route("https://drivex-customer.vercel.app/book/mercedes-g63?period=daily"))
        assertEquals(Route.IN_APP, router.route("https://DRIVEX-CUSTOMER.vercel.app/"))
    }

    @Test fun `payment pages stay in the app so their redirect comes back`() {
        assertEquals(Route.IN_APP, router.route("https://checkout.stripe.com/c/pay/cs_test_abc#xyz"))
        assertEquals(Route.IN_APP, router.route("https://hooks.stripe.com/3d_secure_2/hosted?x=1"))
        assertEquals(Route.IN_APP, router.route("https://pay.ziina.com/abc"))
    }

    @Test fun `files on storage are downloaded`() {
        assertEquals(Route.DOWNLOAD, router.route("https://ampdpgwcjgoqbamfttlw.supabase.co/storage/v1/object/sign/invoices/t/inv.pdf?token=x"))
        assertEquals(Route.BROWSER_TAB, router.route("https://ampdpgwcjgoqbamfttlw.supabase.co/rest/v1/invoices"))
    }

    @Test fun `whatsapp, phone, mail and maps open their apps`() {
        assertEquals(Route.EXTERNAL_APP, router.route("https://wa.me/971501234567?text=Hi"))
        assertEquals(Route.EXTERNAL_APP, router.route("https://api.whatsapp.com/send?phone=971501234567"))
        assertEquals(Route.EXTERNAL_APP, router.route("tel:+971501234567"))
        assertEquals(Route.EXTERNAL_APP, router.route("mailto:hello@drivex.ae"))
        assertEquals(Route.EXTERNAL_APP, router.route("https://www.google.com/maps/place/Dubai"))
        assertEquals(Route.EXTERNAL_APP, router.route("intent://scan/#Intent;scheme=zxing;end"))
    }

    @Test fun `other sites open in a browser tab`() {
        assertEquals(Route.BROWSER_TAB, router.route("https://www.rta.ae/"))
        assertEquals(Route.BROWSER_TAB, router.route("https://drivex-customer.vercel.app.evil.com/"))
    }

    @Test fun `empty and script links are ignored`() {
        assertEquals(Route.IGNORE, router.route(null))
        assertEquals(Route.IGNORE, router.route(""))
        assertEquals(Route.IGNORE, router.route("javascript:void(0)"))
        assertEquals(Route.IGNORE, router.route("blob:https://drivex-customer.vercel.app/123"))
        assertEquals(Route.IGNORE, router.route("not a url with spaces"))
    }
}
