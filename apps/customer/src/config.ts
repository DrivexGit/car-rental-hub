// DriveX contact numbers (from drivex.ae). Override with VITE_SUPPORT_PHONE / VITE_WHATSAPP_NUMBER.
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || "+971561215152";
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "971561215152";
export const whatsappLink = (text = "") => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

// Seller details printed on invoices. The TRN (VAT registration number) comes from VITE_COMPANY_TRN.
export const COMPANY = {
  name: "Drivex Car Rental LLC",
  address: "Dubai, United Arab Emirates", // ponytail: replace with the registered address from DriveX
  phone: SUPPORT_PHONE,
  email: "info@drivex.ae",
  trn: (import.meta.env.VITE_COMPANY_TRN as string | undefined) || undefined,
};
