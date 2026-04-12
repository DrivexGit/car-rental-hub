# Project Memory

## Core
Internal admin dashboard for WhatsApp car rental chatbot. Lovable Cloud backend. No customer-facing UI.
Multi-tenant: all tables have tenant_id, RLS enforces tenant isolation via get_user_tenant_id().
Desktop-first, neutral/clean design. shadcn/ui components. No marketing flair.
Supabase Storage for files (vehicle-images, customer-documents). Never localStorage for real data.

## Memories
- [Architecture](mem://features/architecture) — DB schema, storage, RLS, auth approach, vehicle import
- [Multi-tenancy](mem://features/multitenancy) — tenant_id on all tables, auto-provisioning on signup
