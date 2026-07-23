---
type: integration-runbook
status: beta
updated: 2026-07-23
tags: [fitcrm, integrations, access-control, sigur, zkteco, hikvision]
---

# Контроль доступа

## Статус

Cloud-контур FitCRM реализован: подключения клубов, зашифрованные секреты, привязки карт и
браслетов, проверка абонемента, дедупликация событий, атомарное создание посещения и симулятор.

Аппаратная совместимость **не сертифицирована**. До contract-теста на лицензированном сервере и
реальном контроллере интерфейс обязан показывать статус Beta.

## Архитектура

Локальные серверы Sigur, ZKBio, HikCentral и отдельные терминалы не выставляются в интернет.
Рекомендуемый транспорт:

1. FitCRM Bridge работает в локальной сети клуба.
2. Bridge читает события из локальной СКУД.
3. Bridge отправляет нормализованные события по исходящему HTTPS в FitCRM.
4. FitCRM дедуплицирует событие, находит клиента по карте/браслету и проверяет абонемент.
5. Посещение создаётся только для подтверждённого события физического входа.

Учётные данные производителя (включая HikCentral API Key/API Secret) остаются в локальном
Bridge и не передаются в FitCRM Cloud. Облачная форма хранит только данные аутентификации Bridge.

Sigur Web Delegation может обращаться к FitCRM напрямую, но точный wire-contract доступен только
после активации у производителя. До получения этой спецификации прямой адаптер не включается.

## Ingress-контракт FitCRM Bridge

Заголовок:

```text
X-FitCRM-Access-Key: <per-club secret>
```

Тело:

```json
{
  "externalEventId": "opaque-vendor-event-id",
  "eventType": "passage",
  "direction": "entry",
  "result": "allowed",
  "credentialUid": "0012Ab",
  "occurredAt": "2026-07-23T12:00:00+05:00",
  "deviceId": "reader-1",
  "doorId": "main-entrance",
  "accessRequestId": "optional-prior-access-request-id"
}
```

`credentialUid` всегда считается непрозрачной строкой: ведущие нули и регистр сохраняются.
Для `access_request` и `passage` Bridge обязан передавать стабильный `externalEventId`. Если
производитель не выдаёт ID, Bridge строит его детерминированно из исходного события. Повторная
доставка не создаёт второе посещение и повторно не списывает визит.

Событие `access_request` только проверяет допуск. Посещение создаёт исключительно
`eventType=passage`, `direction=entry`, `result=allowed`.
Если контроллер сначала запрашивает допуск, Bridge передаёт ID этого запроса в
`accessRequestId` подтверждённого события `passage`. Без корреляции FitCRM повторно проверит
квоту и не использует чужую резервацию.

Допуск считается по серверному времени FitCRM, а не по времени, переданному устройством.
Запрос допуска принимается в окне ±2 минуты и резервирует доступный визит на 20 секунд.
Подтверждённый проход принимается не старше 15 минут и не более чем на 2 минуты из будущего.
Повторный вход той же картой в течение 30 секунд блокируется как anti-passback.

## Провайдеры

### Sigur

- Основной режим: Web Delegation + отдельная регистрация событий.
- REST API работает на локальном сервере, по умолчанию порт 9500; наружу его не открывать.
- REST: JWT access token + refresh token; используется Bridge для сверки и восстановления.
- Публичная документация не содержит точную схему Web Delegation, таймауты и гарантии повторов.

Источники:

- https://sigur.com/features/decision_delegation/
- https://sigur.com/doc/Public_REST_API_Developers_Guide.pdf
- https://sigur.com/doc/Sigur_REST_API_Guide.pdf
- https://sigur.com/doc/Portal_Guide.pdf

### ZKTeco

- Для контроля доступа приоритетен ZKBio CVSecurity.
- ZKBio Time/BioTime — преимущественно учёт времени; события безопаснее читать через Bridge.
- API зависит от версии, разрешения пользователя и лицензии.
- Сервер должен быть обновлён: старые сборки имеют опубликованные критические уязвимости.
- WG26/WG34, направление считывателя, timezone и формат ID проверяются при вводе в эксплуатацию.

Источники:

- https://www.zkteco.com/en/ZKBio_CVSecurity_API/ZKBioCVSecurity_API
- https://www.zkteco.com/en/ZKBio_CVSecurity0lN/ZKBio_CVSecurity
- https://www.zkteco.com/en/ZKBioTime_API/ZKBioTime_API
- https://zkteco.com/en/faq

### Hikvision

- Для нескольких устройств предпочтителен HikCentral Professional OpenAPI.
- ISAPI зависит от модели и firmware; используется Bridge в локальной сети.
- ISAPI использует HTTP Digest, HikCentral — API Key/API Secret и подписанные запросы.
- Устройство или HikCentral нельзя публиковать напрямую в интернете.

Источники:

- https://tpp.hikvision.com/solutions/TimeAttendance-Integration
- https://tpp.hikvision.com/eu/HCPIntegration
- https://tpp.hikvision.com/tpp/OpenCapabilities
- https://tpp.hikvision.com/download/ISAPI_OTAP

## Что проверяет симулятор

- изоляцию по `club_id`;
- привязку карты к клиенту;
- активность и срок абонемента;
- остаток посещений;
- атомарное создание визита;
- повторную доставку и журнал решений.

Симулятор не проверяет физическое реле, направление датчиков, offline-буфер контроллера,
фактические таймауты и применение карточки на устройстве.
