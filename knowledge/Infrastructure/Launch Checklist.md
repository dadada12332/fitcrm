---
type: checklist
area: launch
updated: 2026-07-20
---

# Launch Checklist

- [x] Регистрация, onboarding и login проверены с production Supabase; recovery UI/E2E проверен, доставка ждёт SMTP.
- [x] CRUD клиента, назначение абонемента, cash payment и check-in проходят end-to-end.
- [ ] Payme/Click callback, reconcile, duplicate delivery и rollback проверены.
- [ ] Telegram/SMS/email имеют подтверждённую доставку или честно отключены.
- [ ] Support flow и контакты поддержки работают.
- [x] Tenant isolation и роли проверены минимум на двух временных QA-клубах.
- [ ] Backup/restore выполнен; RPO/RTO зафиксированы.
- [ ] Error monitoring, uptime и алерты настроены.
- [ ] Legal/privacy/terms соответствуют реальному сбору данных.
- [ ] Analytics не собирает секреты и лишние персональные данные.
- [x] Миграции `0065`–`0067` применены и имеют обратимые DDL-изменения; release note обновлён.
- [x] Desktop и mobile critical flows проверены в light/dark без horizontal overflow.

## Required before mass launch

- [ ] Подключить брендовый домен и обновить Supabase/OAuth/Telegram/payment callback URLs.
- [ ] Перевести Supabase на Pro, проверить daily backups и выполнить restore drill.
- [ ] Подключить custom SMTP и проверить confirmation/recovery на внешнем адресе.
- [ ] Включить CAPTCHA на signup/recovery и проверить rate limits.
- [ ] Настроить error monitoring, uptime monitor и алерты владельцу.
- [ ] Пройти Payme/Click sandbox/certification с реальными merchant credentials.
- [ ] Зафиксировать поддержку, incident owner, RPO/RTO и юридическое согласование.
