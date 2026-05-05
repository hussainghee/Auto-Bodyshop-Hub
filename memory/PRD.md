# Automotive Service CRM — Kuwait Market

## Original Problem Statement
Lightweight web-based CRM for a small automotive service shop selling paint protection, tinting, full-body paint, car wash, and mobile car wash — built for the Kuwait market with KWD currency (3-decimal formatting).

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts + React Router v7
- **Backend**: FastAPI + Motor (MongoDB async) + JWT auth + bcrypt
- **Storage**: MongoDB; local `/app/backend/uploads` for photo & signature files
- **Theming**: Dark-mode "Performance Pro" aesthetic (Outfit + IBM Plex Sans, #0066FF accent)

## User Personas
- **Admin** — Manages setup (users, services/pricing, vehicle types, makes), full access, reports
- **Sales / Front Desk** — Customers, vehicles, quotations, job cards, payments, inventory
- **Technician** — Sees only assigned jobs; can update status, tick checklist, upload before/after photos, start/stop job timer

## Core Requirements (Static)
- Customer management with multiple vehicles per customer + WhatsApp deep-links
- Vehicle management: types (Sedan/SUV/Truck/Boat + configurable), makes/models cascading (Kuwait-seeded)
- Dynamic services & pricing: fixed, per vehicle-type, per panel, per glass area, full-vehicle package
- Interactive SVG vehicle map with numbered areas + per-area image upload
- Quotation multi-step wizard → Convert to Job Card
- Job statuses: Draft · Confirmed · In Progress · Completed · Cancelled
- Role-based access control
- Inventory with low-stock alerts + auto-deduct on job completion
- Appointment calendar (month view)
- KWD formatting with 3 decimal places

## What's Been Implemented

### Phase 3 — Inventory & Services Restructuring + Payments Report (2026-05-05)
- **Inventory Categories** (new): `inventory_categories` collection with name/description/active/created_at/created_by; CRUD + Excel export. Default "Uncategorized" auto-created on first run; protected from deletion. Categories with linked products cannot be deleted (must reassign or mark inactive).
- **Inventory Products** (rewrite): added `category_id`, `sku`, `cost_price`, `selling_price`, `stock_qty`, `reorder_level`, `unit_of_measure`, `active` status; legacy `category` string preserved for back-compat. List endpoint supports `?q`, `?category_id`, `?status`. Excel export `/export/inventory` honours filters and names file by category.
- **Migration**: legacy items without `category_id` auto-assigned to Uncategorized on backend startup AND inside `/seed` (fixes ordering issue surfaced in iter5).
- **Sidebar**: Inventory becomes a collapsible group → `Categories` + `Products` children.
- **Services rename**: "Services & Pricing" → **"Services"** in sidebar + page header. Route `/services` unchanged. Page now has tab switcher: Services / Categories.
- **Service Categories** (new, free-form): `service_categories` collection with name/description/active. Predefined service category enum dropped; existing services keep their legacy `category` string for display, can be reassigned to a `category_id` from Service form. Admin-only mutations.
- **Payments Report** (new): `GET /reports/payments?start&end&method&received_by` defaults to today; returns payments flat list with payment_date, job#, invoice#, customer name/mobile, plate, method, amount, balance, received_by — plus by-method totals. Excel export `/reports/payments/export` honours filters.
- **Reports page**: tab switcher (Overview / Payments). Date filter defaults to today. Payments tab includes KPIs (Total Collected, Cash, K-Net, Credit Card), filters (method + received-by) and Excel export.
- **Tests**: `/app/backend/tests/test_phase3_inventory_services_payments.py` — 26 tests, 26/26 PASS isolated; full regression 90/90 (after fix).

### Phase 2 — Quotations / Job Cards / Branded PDFs (2026-05-05)
- **Quotation list**: `?q=` searches number/customer name/mobile/plate. `?status`, `?creator`, `?start`, `?end` filters. List rows now include `created_by_name`. Frontend has filter UI + clickable rows.
- **Quotation create wizard**: searchable customer list (name/mobile), vehicle dropdown limited to that customer, service search by name/category, **Select Full Vehicle** + **All Panels** + **All Glass** buttons, discount type toggle (Fixed/Percentage), live recompute of subtotal/discount/tax/grand total, hide discount line in summary when 0. After create → navigate to detail page.
- **Discount data model** (quotations + jobs): `discount` (KWD amount), `discount_type` (`amount`|`percent`), `discount_value` (raw user input). `_calc_totals` + `_resolve_discount` handle both new payload and legacy `{discount: <kwd>}` (legacy treated as type=amount). Percent capped at 100%.
- **Quotation detail**:
  - Removed **Mark Sent**.
  - **Mark Approved** atomically sets status + auto-creates job card (idempotent — no duplicates) and frontend redirects to `/jobs/<id>`.
  - Linked-job button shows on already-approved quotations.
  - Edit modal supports the same discount-type controls.
- **Job list**: filters (status/creator/from/to) and search (`q` matches job#/invoice#/quotation#/customer name/mobile/plate). Always returns `quotation_number` (null when no link).
- **Job detail**: Job Timer **removed**. New "Job Info" side card shows linked quotation (clickable to navigate back), creator name, created/completed timestamps. Invoice edit modal supports discount type/value.
- **Branded PDF** (`BrandedDocument.jsx`) used by both quotation and invoice:
  - Wetworks logo + wordmark + KW address/contact placeholders
  - Title, status badge, meta panel (issue date, valid-until, created-by, job#, quotation#)
  - Bill-to + Vehicle blocks
  - Service line table with Qty / Unit Price / Total (aligned headings)
  - Totals card (Subtotal / Discount only-if-set / Tax / Grand Total / Paid + Balance for invoice)
  - Payments table on invoices
  - Notes + Terms & Conditions section
  - Print-page CSS hides app chrome and outputs A4 pages
  - **No "Made with Emergent"** anywhere
- **WhatsApp share** (`waShareDocument` helper): opens wa.me with templated message including link to the doc URL. Works on both quotation and invoice.
- **Mobile drawer** rewrite: always-mounted with `translate-x` slide animation (resolves the iter3/iter4 testid-not-found false positive). Smooth slide-in on hamburger click.
- **Tests**: `/app/backend/tests/test_phase2_quotations_jobs.py` (15 tests).

### Phase 1.1 — Bug-fixes & Mobile Responsiveness (2026-05-05)
- **Segment Detail page** (`/customers/segments/:id`): name, description, created date, created by, filter chips, customer count, customer table (Name/Mobile/Email/Vehicle(s)/Registered) with WhatsApp deep-link, in-segment search by name/mobile, Excel export. Mobile: customers render as cards instead of table.
- **Multi-select segment filters**: `makes`, `models`, `years`, `colors`, `vehicle_types`, `cities` now accept arrays. Logic: OR-within-group, AND-across-groups. Legacy single-value fields preserved for backward compatibility.
- **Searchable multi-select combobox** (`MultiSelectCombobox.jsx`): Popover + cmdk Command, type-to-search, multi-tag display, used for brand/model/year/color/type/city in Segment form. Models filter to selected brands; if no brands chosen, allow global search across all models.
- **Mobile responsiveness**:
  - Layout: hamburger button + slide-in drawer on screens <md. Desktop sidebar unchanged.
  - PageHeader: stacks title/actions on mobile.
  - Customers, Vehicles, Dashboard tables: `min-w` + horizontal scroll; secondary columns hidden below md/lg.
  - Customer + Segment dialogs: 1-col on mobile, full-width minus margin.
  - Segment Detail: card layout on mobile, table on desktop.
- **Mobile number validation** (Customer create/edit): backend `field_validator` rejects letters/spaces/symbols (allows optional leading `+`). Frontend `onKeyDown` blocks alphabetic input; sanitises paste.
- **Numeric-only inputs**: year, recent_days, min/max job count, min/max total spend (all stripped via `replace(/\D/g,"")` or `/[^0-9.]/g`). Plate, VIN, color, name, email, address remain free-text.
- **Backend extras**: `GET /api/segments/:id` enriches each customer with `vehicles[]`, supports `?q=` filter, returns `created_by_name`. Segment Excel export includes a `Vehicles` column.
- **Tests**: `/app/backend/tests/test_iter3_segments_mobile.py` — 13/13 PASS; full regression 49/49 green.

### Phase 1 — Wetworks Rebrand + CRM Hardening (2026-05-04)
- **Branding**: Wetworks logo on login page + sidebar, "Wetworks" / "CRM" wordmark replacing previous AUTO/CRM
- **Sidebar**: Calendar removed; Customers group with `Customers` + `Segments` children (auto-expands on child routes; toggle is no-op when on an active child)
- **Dashboard**: Outstanding A/R card removed
- **Excel exports**: `GET /api/export/customers?q=`, `GET /api/export/vehicles?q&make&model&year&type&color&start&end` — admin/sales only, xlsx download with proper headers
- **Customer Excel import**: `POST /api/import/customers` (multipart xlsx). Required cols `name`, `mobile`. Skips duplicates by `mobile` (per user choice). Returns `{created, skipped_duplicates, errors[], total_rows}`
- **Customer Segments module** (`/customers/segments`):
  - Backend: `POST /segments/preview`, `GET/POST/DELETE /segments`, `GET /segments/:id`, `GET /segments/:id/export`
  - Filters: vehicle make/model/year_min/year_max/color/type, has_vehicles, city, registered date range, recent_days, **last_service_after/before** (completed jobs only), **min/max_total_spend**, **min/max_job_count**
  - Aggregation joins to `jobs` collection; preview annotates each customer with `job_count`, `total_spend`, `last_service`
  - Admin-only delete; export segment members to xlsx
- **Frontend pages**:
  - `Customers.jsx` — search, Export, Import (with summary modal showing created/skipped/errors)
  - `Vehicles.jsx` — search + brand/model/year/type/color/start/end filters + Export
  - `Segments.jsx` — full CRUD UI with Vehicle / Customer / Behaviour filter sections + preview table (Jobs / Spend / Last Service)
- **Tests**: `/app/backend/tests/test_phase1_segments_export.py` — 13/13 passing (regression iter2 still 23/23 green)

### Iteration 1 (Initial MVP, 2026-04-27)
- JWT auth with 3 seeded roles
- Customers, Vehicles, VehicleTypes, Services (5 pricing modes) CRUD
- Quotation wizard (4 steps) + Convert-to-Job
- Job Card with checklist, before/after photo upload
- Inventory CRUD with low-stock alerts
- Appointment calendar (month view)
- Reports: dashboard, sales, jobs, inventory
- Interactive SVG vehicle map with panel/glass selection + per-area photo upload
- Printable quotation page
- Dark-theme UI with sidebar nav

### Iteration 3 (2026-04-27)
- **Quotation editing post-creation**: Edit button on detail (draft/sent only) → modal to add/remove/edit lines, adjust discount/tax/valid_until/notes → PATCH /quotations/{id}
- **Payment receipt print view**: `/jobs/:jid/receipts/:pid` route with compact printable card (receipt no, date, customer, vehicle, amount, method, auth code, invoice balance); "Receipt" link added on each payment row
- **Materials/Consumption tracking per service line**: `POST /jobs/{id}/line-consumption` with `{line_index, consumed_inventory[]}` — Mark Materials modal with inventory picker, qty, unit, and per-item notes (e.g. "Used 0.5L, remainder stored"). Inventory stock auto-deducts on job completion
- **Internal notes on job**: `PATCH /jobs/{id}/internal-notes` for workshop-only notes (tint/PPF roll leftover tracking, batch labels)
- **Clear visual separation**: Internal sections have amber border + "INTERNAL" badge + `no-print` class so they NEVER appear on customer-facing invoice/quotation prints

### Iteration 2 (2026-04-27)
- **Kuwait makes/models**: 30 makes seeded (Toyota, Lexus, Nissan, Mitsubishi, Land Rover, BMW, Mercedes, etc.) with cascading Make → Model dropdowns; admin-managed in Settings
- **Customer save fixed**: only name + mobile required; email/address/notes strictly optional
- **Inline multi-vehicle** on customer creation form
- **Quotation wizard reordered**: Customer+Vehicle → Services → Areas (conditional, skipped when no per-panel/per-glass service) → Review; "Select All" for panels/glass
- **Quotation valid_until** date + auto-expired detection
- **Signature removed** entirely — direct approve + convert flow
- **Payments module**: methods cash/K-net/Credit Card; auth_code mandatory for K-net & Credit Card (400 error if missing); part-payments supported; balance/status tracking (unpaid/partial/paid)
- **Invoice auto-generation**: INV-XXXXX when job completed
- **Invoice edit**: adjust discount/tax/notes from job detail
- **Job Timer**: technician start/stop, auto-advances status to in_progress on first start
- **Service Bundles**: is_bundle flag + bundle_items display (sample "Detail Plus Bundle" seeded)
- **Notifications panel** (bell + badge in header): low stock, overdue jobs, pending quotations, expired quotations, outstanding A/R
- **Command Palette** (Cmd/Ctrl-K): jump to any customer/job/quotation/vehicle
- **WhatsApp deep-links** on customer row, customer detail, quotation detail, job detail
- **Date-filtered reports** with 7D/30D/90D presets + CSV export
- **P&L report**: revenue, discounts, tax, COGS (from consumed_inventory), gross profit
- **Outstanding A/R dashboard tile**
- **Customer history report** endpoint

## Data Model Summary
```
users        { id, name, email, password(hashed), role, active }
customers    { id, name, mobile, email?, address?, notes?, preferred_contact }
vehicles     { id, customer_id, vehicle_type, make, model, year?, plate?, vin?, color? }
vehicle_types { id, key, label, panels[], glass_areas[] }
vehicle_makes { id, label, models[] }  // Kuwait presets
services     { id, name, category, pricing_mode, fixed_price?, vehicle_type_prices,
               panel_prices, glass_prices, full_vehicle_prices, is_bundle, bundle_items[] }
quotations   { id, number QT-XXXXX, customer_id, vehicle_id, lines[], subtotal,
               discount, tax_rate, tax_amount, total, status, valid_until?, notes? }
jobs         { id, number JC-XXXXX, invoice_number INV-XXXXX?, customer_id, vehicle_id,
               lines[], totals, status, technician_id?, checklist[], before_photos[],
               after_photos[], payments[], time_entries[], completed_at? }
inventory    { id, sku, name, category, unit, cost_price, selling_price,
               stock_qty, low_stock_threshold }
appointments { id, customer_id, vehicle_id?, service_label, start, end?, notes? }
counters     { _id: 'quotation'|'job'|'invoice', seq }
```

## Testing
- `/app/backend/tests/test_iter2_backend.py` — 23/23 passing
- Admin, Sales, Technician RBAC verified
- Full flow tested: quotation → convert → timer → payments (split K-net + cash) → complete → INV auto-generation → P&L

## Prioritized Backlog (P0 → P2)

### P0 (next)
- **Push Phase 1 to GitHub** — user requested commit `Phase 1 - Branding navigation customers vehicles`. Use the **Save to Github** button in the chat input.

### P1 (high value next)
- P&L-adjacent report: actual meters-used vs meters-billed per roll SKU (tint/PPF leftover analysis)
- Refactor `server.py` (now 1500+ lines) into modules: auth, customers, vehicles, jobs, quotations, reports, segments, export_import, seed
- Quotation editing after creation (currently view-only post-create)
- Inventory movement report with date filter + consumed vs restocked log
- Receipt print view (filtered "Payment Receipt" per payment entry)
- SMS/email notification when quotation sent (requires integration)
- Audit log view of who-changed-what

### P2 (nice to have)
- Operational expenses tracking (to complete true Net Profit P&L)
- Service-time estimates → Calendar auto-block slots
- Customer loyalty / repeat-visit discount rules
- Advanced search with filters on Jobs list (date, technician, payment status)
- Bulk CSV import for customers/vehicles
- Multi-location / branch support
- Arabic RTL UI toggle

### P3 (future)
- Mobile technician app (PWA) for offline checklist/photo capture
- Digital pre-inspection form with damage markup on vehicle map
- Inventory purchase orders + supplier management
- SLA / job time targets with alerts

## Test Credentials
See `/app/memory/test_credentials.md`
