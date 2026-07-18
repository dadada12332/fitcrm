---
id: TASK-0018
type: bug
status: done
priority: P2
module: ai-analytics
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, ai, layout, responsive]
---

# Align AI Analytics page spacing

AI Analytics added its own responsive page padding inside the standard AppShell content padding. Desktop content therefore started 44px from the inner edge instead of the shared 20px used by Dashboard and Clients.

Removed the duplicate root padding from `AiChat`; internal panel padding remains unchanged. Production browser verification: desktop heading offset now equals the AppShell 20px padding; mobile padding is 16px and viewport/scroll width is `390/390`.

Commit `2628a08`; deployment `dpl_CykuuvUCy9ZbntJTWwAtbQ22ajLC` READY on `fitcrm-three.vercel.app`. TypeScript, target ESLint and Vitest (`97 passed`, `1 skipped`) passed.
