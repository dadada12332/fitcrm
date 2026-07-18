---
type: testing-matrix
updated: 2026-07-18
---

# Testing Matrix

| Область | Unit | Integration | E2E | Manual | Last checked | Gap |
|---|---|---|---|---|---|---|
| Auth/onboarding | Permissions/search unit | Нет | Playwright public auth + private redirects | Да | 2026-07-18 | Полный onboarding с test DB |
| Tenant/RLS | Static migration + action guard | Opt-in two-club test; live rollback drill passed | Нет | Да | 2026-07-18 | Автозапуск требует staging/local Supabase |
| Clients/memberships | Server Action guards | Нет | Protected-route smoke | Да | 2026-07-18 | Data-mutating CRUD regression |
| Payments/Payme/Click | Server Action/RPC guards | Нет | Protected-route smoke | Частично | 2026-07-18 | Callback и идемпотентность на test DB |
| Visits/schedule | Server Action guards | Нет | Protected-route smoke | Да | 2026-07-18 | Конкурентные check-in/booking |
| Reports | Нет | RPC вручную | Нет | Да | 2026-07-16 | Корректность агрегатов и export |
| Platform Admin | Нет | Нет | Нет | Да | 2026-07-18 | Permissions и impersonation |
| Responsive UI | Нет | Нет | Desktop Chromium + Pixel 7 auth smoke | Да | 2026-07-18 | Authenticated CRM viewport suite |

Команды: `npm test`, `npm run test:security`, `npm run test:e2e`, `npm run test:all`, `npx tsc --noEmit`, `npm run build`. Lint имеет известный исторический долг.
