---
type: ownership-map
updated: 2026-07-18
---

# Ownership Map

| Модуль | Основные пути | Таблицы/RPC | Routes/API |
|---|---|---|---|
| Auth/onboarding | `src/app/(auth)`, `src/lib/supabase`, `src/lib/club.ts` | `users`, `clubs`, `staff`, `create_club`, `handle_new_user` | `/login`, `/register`, `/onboarding`, `/auth/callback` |
| Clients | `src/app/(app)/clients` | `clients`, `subscriptions`, `clients_page`, `clients_stats` | `/clients`, `/clients/[id]` |
| Memberships | `src/app/(app)/memberships` | `memberships`, `subscriptions` | `/memberships` |
| Visits | `src/app/(app)/visits` | `visits`, `visits_page`, `get_visits_kpi` | `/visits` |
| Schedule | `src/app/(app)/schedule` | `schedules`, `classes`, `class_bookings`, `rooms` | `/schedule` |
| Payments | `src/app/(app)/payments`, `src/app/api/payme`, `src/app/api/click` | `payments`, `payme_transactions`, `acquiring_transactions`, `payments_page` | `/payments`, payment callbacks |
| Warehouse | `src/app/(app)/warehouse` | `products`, `inventory`, `stock_movements` | `/warehouse` |
| Reports | `src/app/(app)/reports` | `reports_*` RPC | `/reports`, `/reports/export` |
| Staff/RBAC | `src/app/(app)/staff`, permission helpers | `staff`, roles/permissions migrations | `/staff`, `/staff/[id]` |
| Support | `src/app/(app)/support`, Platform support | `support_*`, `platform_tickets` | `/support`, `/platform/support` |
| Platform Admin | `src/app/platform` | `platform_*`, `plans`, `platform_clubs_metrics` | `/platform/*` |
| Telegram | `src/lib/telegram`, `src/app/api/telegram` | `telegram_users`, `broadcasts`, `notifications` | webhook/setup/daily report |

Security ownership is shared: every mutation owner must enforce module permissions in addition to RLS.
