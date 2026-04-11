

# WhatsApp Car Rental Admin Panel — MVP Plan

## Database Schema (Supabase)
Create all 9 tables as specified: `staff_profiles`, `vehicles`, `vehicle_images`, `leads`, `messages`, `conversation_states`, `reservations`, `customer_documents`, `faq_entries` — with all fields, indexes, and foreign keys exactly as described.

## Storage Buckets
- `vehicle-images` — for car photos uploaded by admins
- `customer-documents` — for passport, visa, license, ID uploads

## RLS Policies
Simple authenticated-staff-only access: all tables gated by checking the user has an active `staff_profiles` record. Storage buckets similarly restricted to authenticated users.

## Seed Data
Sample vehicles (5), leads (4), messages (10+), reservations (3), FAQ entries (5) to make the dashboard immediately usable.

## Admin UI Pages

### 1. Login
Clean Supabase email/password auth. Redirects to dashboard on success.

### 2. Dashboard
Summary cards: total/available/booked vehicles, total leads, in-progress leads, open reservations, pending documents.

### 3. CRM / Leads
Table with search (name/phone), filters (status, stage, assigned staff). Row click → lead detail page.

### 4. Lead Details
Sections: customer info, conversation state, reservations, recent messages, documents, notes. Action buttons for status changes, handoff, create reservation, upload document.

### 5. Messages
Filterable table/list of all messages. Search by text or phone. Click → opens related lead.

### 6. Vehicles
Table with search (plate, make, model), status filter. Import button (Excel/CSV). Row click → vehicle detail.

### 7. Vehicle Details
Info card, image gallery (upload/remove/reorder via Supabase Storage), status, upcoming reservations, mini calendar availability, manual block/reservation button.

### 8. Vehicle Import
Upload Excel/CSV → preview mapped rows → upsert by plate_number/chassis_number → show result summary (inserted/updated/skipped/failed). Column mapping as specified.

### 9. Calendar / Schedule
Monthly/weekly/daily calendar view showing reservations & blocks per vehicle. Filter by vehicle. Click to create block or view reservation details.

### 10. Reservations
Table with filters (status, vehicle, date range). Create/edit/cancel reservations. Links to lead and vehicle.

### 11. FAQ Management
Simple CRUD list: question, answer, category, active toggle, sort order.

## Design
- Sidebar navigation with all sections
- Neutral/clean color scheme (grays, whites, subtle accents)
- Desktop-first, responsive
- shadcn/ui components (tables, cards, dialogs, forms)
- No marketing flair — pure operational UI

## Key Flows
- **Image upload**: Admin uploads → file goes to `vehicle-images` bucket → metadata row in `vehicle_images` table → gallery renders from storage URLs
- **Document upload**: Same pattern with `customer-documents` bucket and `customer_documents` table, with verification status tracking
- **Vehicle import**: Parse Excel/CSV client-side (SheetJS) → preview → upsert via Supabase → summary
- **Calendar availability**: Derived from `reservations` table where status in (draft, pending, confirmed, blocked)

