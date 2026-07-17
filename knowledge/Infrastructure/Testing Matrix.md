---
type: testing-matrix
updated: 2026-07-18
---

# Testing Matrix

| Область | Unit | Integration | E2E | Manual | Last checked | Gap |
|---|---|---|---|---|---|---|
| Auth/onboarding | Нет | Нет | Ad hoc Playwright | Да | 2026-07-17 | Нет повторяемого набора |
| Tenant/RLS | Нет | Ручной audit | Нет | Да | 2026-07-16 | Нужна автоматическая изоляция двух клубов |
| Clients/memberships | Нет | Нет | Ad hoc Playwright | Да | 2026-07-17 | CRUD и mobile regression |
| Payments/Payme/Click | Нет | Нет | Нет | Частично | Не проверено | Callback, идемпотентность, reconcile |
| Visits/schedule | Нет | Нет | Ad hoc | Да | 2026-07-17 | Конкурентные check-in/booking |
| Reports | Нет | RPC вручную | Нет | Да | 2026-07-16 | Корректность агрегатов и export |
| Platform Admin | Нет | Нет | Нет | Да | 2026-07-18 | Permissions и impersonation |
| Responsive UI | Нет | Нет | Ad hoc screenshots | Да | 2026-07-18 | Автоматический viewport smoke |

Общие доступные проверки: `npx tsc --noEmit`, `npm run build`, `npm run lint` с известным lint-долгом.
