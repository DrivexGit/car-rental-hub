// Version of the Terms & Rental rules the customer accepts at checkout. Shared with the server (api/book.ts), which stores it on the reservation.
// No imports on purpose: it is bundled into the browser as well. Change it when the terms text changes.
export const TERMS_VERSION = "2026-10";
