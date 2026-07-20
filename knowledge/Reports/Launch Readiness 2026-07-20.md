---
type: report
area: launch
status: no-go-mass-launch
updated: 2026-07-20
tags: [fitcrm, launch, security, qa]
---

# Launch Readiness — 2026-07-20

## Verdict

**Controlled beta: GO. Mass public launch: NO-GO until the external blockers below are closed.**

The core CRM is functional on desktop and mobile. Auth, onboarding, client creation, membership assignment, cash payment, manual check-in, Telegram Mini App navigation and tenant isolation were verified against the production Supabase project with disposable QA data.

## Verified

- Production deployment `dpl_Dg9zXEEborGRH7PCNzUBdb13hPwt` for commit `7a01d28` is READY and aliased to `fitcrm-three.vercel.app`.
- Production build completes on Next.js 16.2.7; TypeScript passes.
- Vitest: 105 passed, 1 skipped. Playwright: 30 passed.
- 18 desktop and 10 mobile authenticated routes returned 200, rendered content and had no horizontal overflow.
- Dark mobile checks passed for dashboard, clients, visits, reports, roles and support.
- Registration resumes the correct onboarding step; club creation occurs during onboarding, not before email confirmation.
- Client → membership → cash payment → manual visit passed end-to-end.
- Two-club production RLS probe returned zero cross-tenant rows and rejected a cross-tenant insert.
- Supabase security hardening migrations `0065`–`0067` are applied; missing foreign-key indexes and broad storage listing policies were fixed.
- Scheduled Telegram broadcasts run through Supabase Cron every five minutes; recent HTTP responses were 200.
- Roles and support creation use right drawers; the roles loading regression and theme hydration mismatch were fixed.
- Production-domain smoke produced only 200/303 responses and no grouped Vercel runtime errors. Warm authenticated route samples were approximately 1.6–2.7 seconds; further query reduction remains desirable before a large campaign.

## Fixed in this audit

- Registration terms are persisted; raw Supabase auth errors are no longer shown to users.
- Login and OAuth callback now resume incomplete onboarding instead of entering the CRM early.
- Onboarding saves step progress and sends real staff invitations.
- Client creation rolls back when the selected membership or subscription cannot be created.
- Manual visit's “Создать нового” action now opens the client drawer.
- Removed a non-functional Telegram debt reminder action from reports.
- Settings now validates the user with `getUser()` instead of trusting `getSession()`.
- Notification count is loaded with the sidebar aggregate; full notification data loads only when opened.
- Product photos are tenant-scoped in Storage; broadcast uploads have MIME and size limits.
- Remaining database foreign keys received covering indexes.

## Mass-launch blockers

1. **Custom SMTP:** Supabase Auth still uses the non-production default sender. Arbitrary customer confirmations and password resets are not deliverable reliably.
2. **Production plans and recovery:** Supabase is on Free, without managed daily backups, leaked-password protection or a staging branch. Vercel must also be moved from a personal/Hobby setup to an appropriate commercial plan.
3. **Branded domain:** only `*.vercel.app` domains are attached. After adding the domain, update Supabase Site URL/redirect allow-list, Google OAuth and Telegram/Payme/Click callback URLs.
4. **Abuse protection:** CAPTCHA is not enabled on signup/recovery.
5. **Payments:** cash flow is verified, but real Payme/Click merchant credentials, signed callbacks, duplicate delivery, refund and reconciliation must pass provider sandbox/certification.
6. **Observability:** no Sentry-equivalent error capture, uptime checks or owner alerts are configured.
7. **Operations and legal:** privacy/terms require legal-owner review; support SLA, incident owner, RPO/RTO and restore drill are not signed off.

## Controlled debt

- Full ESLint currently reports 122 errors and 45 warnings, mostly legacy React Compiler rules and explicit `any`; production TypeScript/build still pass.
- A design scan found extensive legacy raw colors. New work follows tokens, but wholesale replacement needs a dedicated visual-regression task.
- Four moderate transitive npm advisories remain; there are no high/critical advisories and the suggested automatic fixes are breaking downgrades.
- Real production latency must be measured after this deployment. Local development includes Sydney database round trips and is not representative of Vercel `syd1` runtime.

## Go-live gate

Mass launch changes to GO only when every unchecked item in [[Infrastructure/Launch Checklist]] is signed off and a final production-domain smoke test passes.
