// DriveX contact numbers (from drivex.ae). Override with VITE_SUPPORT_PHONE / VITE_WHATSAPP_NUMBER.
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || "+971561215152";
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "971561215152";
export const whatsappLink = (text = "") => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
