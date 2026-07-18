---
id: TASK-0017
type: feature
status: done
priority: P1
module: telegram-miniapp
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, telegram, identity, visits, clients]
---

# Link Telegram visits by CRM client ID

## Problem

Telegram display name and CRM full name legitimately differ. Names and usernames are mutable and non-unique, so they cannot identify a client or determine whose visit, subscription or payment is being processed.

## Identity model

1. The client shares their own verified Telegram contact with the club bot.
2. The bot normalizes the phone and finds an exact match inside the current `club_id`.
3. `telegram_users` stores `(club_id, telegram_id) -> client_id` plus a separate Telegram profile snapshot.
4. Mini App authentication resolves only this link. All subscriptions, bookings, payments and visits use the internal `clients.id` UUID.
5. Dynamic QR signs `club_id + client_id`; the CRM scanner validates both and writes `visits.client_id`.

Telegram and CRM names are presentation fields only. They are never lookup keys for a visit.

## Safeguards

- Migration `0064` adds exact normalized phone lookup and rejects ambiguous duplicate client/staff phones.
- One CRM client card can have only one active Telegram account per club; verified relinking replaces the previous account.
- Composite FK prevents cross-club Telegram-to-client links even through service-role code.
- Mini App profile shows Telegram identity and the linked CRM card separately.
- CRM client card shows the stored Telegram display name, username and Telegram ID.

## Verification

- Production database: normalized generated phone, unique client link and composite tenant FK present; cross-club links `0`.
- Production API: link client ID, response client ID and QR payload client ID are identical; route club ID equals QR club ID.
- Signed Telegram name and stored profile snapshot match; CRM identity remains separate.
- TypeScript, target ESLint, Vitest (`97 passed`, `1 skipped`), production build and local/remote mobile Playwright passed.
- Commit `2e3e585`; deployment `dpl_Bt1XhboLwxrkWs5SBEa3PmECkR62` READY on `fitcrm-three.vercel.app`.
