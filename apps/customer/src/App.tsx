import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { TabBar } from "@/components/ui";
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

const TAB_ROUTES = ["/", "/book", "/support", "/bookings", "/profile"];

export default function App() {
  const { user } = useStore();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;

  return (
    <>
      <Routes>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {TAB_ROUTES.includes(pathname) && <TabBar />}
    </>
  );
}
