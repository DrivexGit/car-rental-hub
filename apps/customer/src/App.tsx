import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import { TabBar } from "@/components/ui";
import { DesktopHeader, Footer } from "@/components/DesktopShell";
import { Splash } from "@/components/Splash";
import { Onboarding } from "@/components/Onboarding";
import Inbox from "@/screens/Inbox";
import Login from "@/screens/Login";
import Home from "@/screens/Home";
import Book from "@/screens/Book";
import Reserve from "@/screens/Reserve";
import Checkout from "@/screens/Checkout";
import Confirmed from "@/screens/Confirmed";
import Bookings from "@/screens/Bookings";
import BookingDetail from "@/screens/BookingDetail";
import Support from "@/screens/Support";
import Profile from "@/screens/Profile";
import { Payments, Documents, Notifications, Language, Legal, EditProfile, Security, Other } from "@/screens/ProfilePages";

// Booking steps keep a fixed action bar at the bottom, so they get no footer.
const FOCUSED = /^\/(checkout|book\/.+)$/;
const TAB_ROUTES = ["/", "/book", "/support", "/bookings", "/profile"];

export default function App() {
  const { user, ready, refresh } = useStore();
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  // Back from Ziina checkout: confirm the payment with the provider, then reload data.
  useEffect(() => {
    const id = new URLSearchParams(search).get("payment");
    if (id && user) api("pay", { action: "confirm", paymentId: id }).catch(() => {}).finally(refresh);
  }, [search, user, refresh]);

  return <><Splash ready={ready} /><Body /></>;
}

function Body() {
  const { user, ready } = useStore();
  const location = useLocation();
  const { pathname } = location;
  if (!ready) return <div className="grid h-full place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;

  return (
    <>
      <Onboarding />
      <div className="h-full lg:flex lg:h-auto lg:min-h-full lg:flex-col">
      <DesktopHeader />
      <div className="h-full lg:flex-1">
      {/* Quick fade-out of the old page before the next one slides in, so a tap never feels like a hard jump. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pathname} className="h-full" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/book/:carId" element={<Reserve />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/confirmed/:id" element={<Confirmed />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/bookings/:id" element={<BookingDetail />} />
        <Route path="/support" element={<Support />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/profile/payments" element={<Payments />} />
        <Route path="/profile/security" element={<Security />} />
        <Route path="/profile/documents" element={<Documents />} />
        <Route path="/profile/notifications" element={<Notifications />} />
        <Route path="/profile/language" element={<Language />} />
        <Route path="/profile/legal" element={<Legal />} />
        <Route path="/profile/other" element={<Other />} />
        <Route path="/notifications" element={<Inbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        </motion.div>
      </AnimatePresence>
      </div>
      {!FOCUSED.test(pathname) && <Footer />}
      </div>
      {TAB_ROUTES.includes(pathname) && <TabBar />}
    </>
  );
}
