---
type: ux-audit
status: pre-deploy
updated: 2026-08-04
tags: [zalkins, ux, subscription, billing, recovery]
---

# Subscription Renewal Audit — 2026-08-04

## Scope and user goal

Проверен путь владельца клуба от предупреждения о скором окончании тарифа до восстановления
доступа после подтверждения оплаты. Главная задача пользователя: заранее понять дату окончания,
не потерять данные, продлить текущий тариф без путаницы и видеть честный статус заявки.

Аудит относится к локально собранному change set. Production deployment и применение миграций
на момент документа не подтверждены.

## Overall health

**Готов к контролируемому rollout после обязательной схемы `expand → app → contract`.**

Критический UX-дефект исходного экрана закрыт: назначенный Business больше не считается активным
после истечения оплаченного периода, на карточке есть явный статус и действие продления. Данные
клуба сохраняются, а заблокированный владелец получает recovery-контур вместо тупика. Pending
заявка видна отдельно. Security review не оставил Critical/High/Medium замечаний.

## Numbered end-to-end flow

1. **Обычная работа при активном тарифе — Healthy.**
   CRM доступна полностью; название плана и entitlement остаются источником лимитов, а состояние
   оплаченного периода отдельно определяет доступ.

2. **За 7 дней до окончания — Healthy.**
   Постоянный баннер показывает тариф, точное число дней и дату, CTA ведёт прямо в продление.
   Баннер адаптируется на mobile и не перекрывает dashboard.

   ![Mobile banner за 3 дня](../../artifacts/subscription-expiring-dashboard-mobile-current.png)

3. **Напоминания 7/3/1/0/overdue — Healthy with Low delivery caveat.**
   Cron создаёт CRM-уведомление и отправляет Telegram владельцу один раз на milestone с учётом
   языка и таймзоны клуба. Lease и уникальность защищают обычные повторы. Узкое окно повторной
   Telegram-доставки описано в разделе Residual risk.

4. **Истечение оплаченного периода — Healthy.**
   Операционная CRM блокируется до рендера защищённых данных. Владелец видит название клуба,
   понятную причину, CTA «Продлить Business», поддержку и выход. Данные не удаляются.

   ![Recovery lock после истечения](../../artifacts/subscription-renewal-lock-desktop-current.png)

5. **Переход на экран подписки — Healthy.**
   Доступен узкий recovery shell только с «Подпиской» и «Поддержкой». Карточка Business явно
   показывает `Подписка истекла`, дату и `0 дн.`; бывший текущий тариф выделен expired-state,
   а не badge `Текущий`.

   ![Исправленный expired экран desktop](../../artifacts/subscription-renewal-expired-desktop-current.png)

6. **Выбор продления — Healthy.**
   Владелец может выбрать 1/3/12 месяцев и продлить Business либо перейти на другой допустимый
   тариф. UI показывает сумму и период до отправки. Promo/compensation учитываются при quote,
   но сервер повторно валидирует их.

7. **Создание заявки — Healthy.**
   Заявка сохраняет неизменяемый снимок plan, amount, currency, months, promo и compensation.
   Только одна pending-заявка может существовать для клуба. Повторный submit не создаёт
   конкурирующие коммерческие договорённости.

8. **Ожидание оплаты — Healthy.**
   Pending показан отдельной синей карточкой с тарифом, периодом, суммой и кнопкой отмены; он не
   называется активной подпиской. Ошибка отмены больше не скрывается. Mobile reflow сохраняет
   читаемость и следующую доступную операцию.

   ![Pending-заявка mobile](../../artifacts/subscription-renewal-pending-mobile-current.png)

9. **Одобрение Platform Admin — Healthy, rollout-sensitive.**
   Atomic RPC блокирует заявку и клуб, повторно проверяет план и фактическую вместимость,
   применяет immutable quote, продлевает тот же план от `max(now, current_expiry)` или начинает
   смену плана от `now`, затем пишет audit. Оплата не снимает операционный `suspended`.

10. **Восстановление CRM — Healthy.**
    После подтверждения оплаченный период снова становится active, recovery shell исчезает и
    возвращается полный CRM-доступ. При отказе или отмене expired-state сохраняется с возможностью
    отправить новую заявку.

## Strengths

- Честное разделение `plan` и `subscription state` устраняет главный источник недоверия.
- До блокировки есть ранний CTA; после блокировки остаётся прямой путь к оплате и поддержке.
- Recovery выполняется без удаления или миграции пользовательских данных.
- Desktop и mobile используют существующую дизайн-систему, понятные semantic states и единый
  визуальный язык CRM.
- Immutable quote и атомарное approval связывают обещание UI с фактической суммой в БД.

## UX and accessibility risks

- Строгая блокировка без grace period может быть болезненной для подтверждаемого банковского
  перевода. Следующее продуктовое решение — отдельно утвердить grace/read-only policy, а не
  скрыто ослаблять текущий gate.
- Красный expired-state сопровождается текстом и иконкой, поэтому смысл не зависит только от
  цвета. Однако keyboard order, focus return после pending/cancel и screen-reader announcements
  нельзя полностью подтвердить по screenshots; нужен отдельный интерактивный accessibility pass.
- Mobile screenshots подтверждают reflow, но не являются доказательством полной WCAG compliance,
  zoom 200/400% или всех сочетаний системного размера шрифта.

## Research basis

- YCLIENTS уведомляет о скором окончании лицензии и ведёт пользователя к оплате; полезный
  локальный паттерн — сообщения за 3 дня, 1 день и после окончания:
  https://support.yclients.com/117
- YCLIENTS отдельно документирует понятный путь продления и способы оплаты:
  https://support.yclients.com/82-536--sposoby-oplaty-yclients-rf/
- Stripe различает lifecycle-состояния подписки вместо бинарного «тариф есть/нет»:
  https://docs.stripe.com/billing/subscriptions/overview
- Stripe Revenue Recovery использует настраиваемые напоминания и recovery communication:
  https://docs.stripe.com/billing/revenue-recovery/customer-emails
- Stripe Customer Portal подтверждает self-service паттерн управления текущей подпиской:
  https://docs.stripe.com/customer-management

Fitness CRM comparison, плюсы/минусы Zalkins и приоритеты automation/retention/PWA/lead pipeline
сохранены в [[Research/Competitive CRM research 2026-07-19]].

## Rollout contract

1. Применить `20260804103933_platform_billing_renewal_hardening.sql` (**expand**). Она добавляет
   совместимые поля/RPC и временно блокирует billing approval ошибкой
   `billing_approval_contract_pending`.
2. Опубликовать совместимое приложение и дождаться состояния deployment `READY`.
3. Применить `20260804110824_platform_billing_renewal_contract.sql` (**contract**). Она включает
   авторитетные DB lifecycle gates и снимает временную approval freeze.
4. Не применять expand повторно после contract: это снова включит freeze.
5. Проверить основной alias, expired recovery, pending/approve и отсутствие operational доступа
   до продления; только после этого фиксировать production rollout как завершённый.

## Verification completed before deploy

- `npm test`: **213 passed, 1 skipped**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed на Next.js 16.2.12.
- `git diff --check`: passed.
- Expand + contract проверены совместно в транзакции с `ROLLBACK`.
- Runtime rollback-сценарии подтвердили approval freeze, staff quota/invitation,
  same-plan renewal, plan change, Trial restrictions, stale permission reset и DB gates.
- Security review: нет открытых Critical/High/Medium замечаний.
- Local visual QA: desktop expired/recovery и mobile expiring/pending; screenshots выше являются
  локальными доказательствами, не production evidence.

## Residual risk

**Low — Telegram at-least-once duplicate.** Если Telegram уже принял сообщение, а финальная
запись статуса доставки в БД завершилась ошибкой, lease может быть подобран повторно и владелец
получит дубликат одного milestone. Это не открывает доступ и не меняет billing state. Для строгой
delivery semantics нужен outbox либо промежуточный статус `delivery_unknown` с reconciliation.

## Evidence index

- [Reference vs fixed, exact viewport](../../artifacts/subscription-renewal-comparison-exact-viewport-final.png)
- [Expired desktop, current local build](../../artifacts/subscription-renewal-expired-desktop-current.png)
- [Expired mobile, current local build](../../artifacts/subscription-renewal-expired-mobile-current.png)
- [Recovery lock desktop](../../artifacts/subscription-renewal-lock-desktop-current.png)
- [Expiring dashboard desktop](../../artifacts/subscription-expiring-dashboard-desktop-current.png)
- [Expiring dashboard mobile](../../artifacts/subscription-expiring-dashboard-mobile-current.png)
- [Pending request desktop](../../artifacts/subscription-renewal-pending-desktop-current.png)
- [Pending request mobile](../../artifacts/subscription-renewal-pending-mobile-current.png)
