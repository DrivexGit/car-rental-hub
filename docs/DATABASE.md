# Database Structure Documentation

## Multi-Tenancy

All data is isolated per tenant. Each user belongs to a tenant via `staff_profiles.tenant_id`. RLS policies use `get_user_tenant_id()` to enforce isolation — users can only read/write data that shares their `tenant_id`.

---

## Tables

### `tenants`
Represents a company/organization using the system.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| name | text | No | — | Company name |
| slug | text | No | — | Unique slug |
| is_active | boolean | No | true | |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### `staff_profiles`
Admin/staff accounts for dashboard access. One per auth.users entry.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | — | PK, references auth.users |
| tenant_id | uuid | Yes | — | FK → tenants |
| full_name | text | Yes | — | |
| role | text | No | 'admin' | admin, agent |
| is_active | boolean | No | true | |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### `vehicles`
Imported vehicle inventory.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| source_row_number | integer | Yes | — | Row # from import file |
| plate_number | text | No | — | Unique |
| make | text | No | — | |
| model | text | No | — | |
| year | integer | Yes | — | |
| color | text | Yes | — | |
| categories_raw | text | Yes | — | Raw CSV categories |
| categories | text[] | Yes | — | Parsed array |
| current_location | text | Yes | — | |
| status | text | No | 'available' | available, booked, maintenance, unavailable |
| expected_return_date | timestamptz | Yes | — | |
| upcoming_reservations_raw | text | Yes | — | |
| latest_return_date | timestamptz | Yes | — | |
| odometer | integer | Yes | — | |
| chassis_number | text | Yes | — | Unique |
| notes | text | Yes | — | |
| is_active | boolean | No | true | |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### `vehicle_images`
Metadata for vehicle images stored in Supabase Storage (`vehicle-images` bucket).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| vehicle_id | uuid | No | — | FK → vehicles |
| storage_bucket | text | No | 'vehicle-images' | |
| storage_path | text | No | — | |
| file_name | text | No | — | |
| mime_type | text | Yes | — | |
| file_size | integer | Yes | — | |
| is_primary | boolean | No | false | |
| sort_order | integer | No | 0 | |
| created_at | timestamptz | No | now() | |

### `leads`
Customers/leads from WhatsApp and other channels. Lightweight CRM.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| whatsapp_number | text | No | — | Unique |
| full_name | text | Yes | — | |
| source | text | Yes | — | whatsapp, website, instagram, ads, manual |
| status | text | No | 'new' | new, qualified, in_progress, waiting_customer, reserved, handed_to_human, closed |
| current_stage | text | No | 'new_lead' | See chatbot stages below |
| notes | text | Yes | — | |
| assigned_staff_id | uuid | Yes | — | FK → staff_profiles |
| last_message_at | timestamptz | Yes | — | |
| first_seen_at | timestamptz | No | now() | |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### `messages`
All inbound and outbound messages.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| lead_id | uuid | No | — | FK → leads |
| direction | text | No | — | inbound, outbound |
| channel | text | No | 'whatsapp' | |
| message_text | text | No | — | |
| detected_intent | text | Yes | — | |
| stage_at_time | text | Yes | — | |
| message_type | text | No | 'text' | |
| created_at | timestamptz | No | now() | |

### `conversation_states`
Structured chatbot state for each lead.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| lead_id | uuid | No | — | FK → leads (unique) |
| current_stage | text | No | 'new_lead' | |
| last_intent | text | Yes | — | |
| missing_fields | jsonb | Yes | — | |
| collected_fields | jsonb | Yes | — | |
| selected_vehicle_id | uuid | Yes | — | FK → vehicles |
| quoted_options | jsonb | Yes | — | |
| ai_summary | text | Yes | — | |
| handoff_needed | boolean | No | false | |
| updated_at | timestamptz | No | now() | |

### `reservations`
Bookings, blocks, and drafts. Powers calendar availability.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| lead_id | uuid | Yes | — | FK → leads |
| vehicle_id | uuid | No | — | FK → vehicles |
| source | text | No | 'chatbot' | chatbot, manual_admin, imported |
| status | text | No | 'draft' | draft, pending, confirmed, blocked, completed, cancelled |
| reservation_type | text | No | 'booking' | booking, block |
| start_datetime | timestamptz | No | — | |
| end_datetime | timestamptz | No | — | |
| pickup_location | text | Yes | — | |
| return_location | text | Yes | — | |
| customer_name_snapshot | text | Yes | — | |
| customer_phone_snapshot | text | Yes | — | |
| price_note | text | Yes | — | |
| internal_note | text | Yes | — | |
| created_by_staff_id | uuid | Yes | — | FK → staff_profiles |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### `customer_documents`
Metadata for customer documents stored in Supabase Storage (`customer-documents` bucket).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| lead_id | uuid | No | — | FK → leads |
| reservation_id | uuid | Yes | — | FK → reservations |
| document_type | text | No | — | passport, visa, driving_license, id_card, other |
| storage_bucket | text | No | 'customer-documents' | |
| storage_path | text | No | — | |
| file_name | text | No | — | |
| mime_type | text | Yes | — | |
| file_size | integer | Yes | — | |
| uploaded_by | text | No | 'customer' | customer, admin |
| verification_status | text | No | 'pending' | pending, approved, rejected |
| note | text | Yes | — | |
| created_at | timestamptz | No | now() | |

### `faq_entries`
FAQ knowledge base for the chatbot.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | No | gen_random_uuid() | PK |
| tenant_id | uuid | Yes | — | FK → tenants |
| category | text | Yes | — | |
| question | text | No | — | |
| answer | text | No | — | |
| is_active | boolean | No | true | |
| sort_order | integer | No | 0 | |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

---

## Chatbot Stages

These are the possible values for `current_stage`:

- `new_lead`
- `faq_mode`
- `collect_rental_date`
- `collect_duration`
- `collect_car_preference`
- `collect_budget_optional`
- `collect_delivery_location`
- `collect_return_location`
- `check_inventory`
- `present_options`
- `awaiting_car_selection`
- `collect_customer_full_name`
- `collect_documents_info`
- `reservation_draft_ready`
- `reservation_confirmed`
- `human_handoff`
- `closed`

---

## Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `vehicle-images` | Yes | Car photos uploaded by admins |
| `customer-documents` | No | Passport, visa, license, ID uploads |

---

## RLS (Row Level Security)

All tables use tenant-based RLS. The function `get_user_tenant_id()` returns the `tenant_id` of the currently authenticated user from `staff_profiles`. Every policy filters by `tenant_id = get_user_tenant_id()`.

**Helper functions:**
- `is_active_staff()` — returns true if current user has an active staff_profiles record
- `get_user_tenant_id()` — returns the tenant_id for the current user

---

## Indexes

Key indexes for performance:
- `leads`: whatsapp_number, status, current_stage, assigned_staff_id, tenant_id
- `messages`: lead_id, created_at, direction, tenant_id
- `vehicles`: plate_number, status, make, model, tenant_id
- `reservations`: vehicle_id, lead_id, start_datetime, end_datetime, tenant_id
- `customer_documents`: lead_id, tenant_id
- `vehicle_images`: vehicle_id, tenant_id
