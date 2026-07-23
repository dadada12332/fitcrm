# Hikvision adapter

The adapter supports two official Hikvision integration surfaces:

- `mode: "isapi"` connects directly to a device's
  `/ISAPI/Event/notification/alertStream`, negotiates HTTP Digest authentication, and parses
  XML/JSON `EventNotificationAlert` messages (including multipart streams).
- `mode: "hikcentral"` signs Artemis OpenAPI requests with HMAC-SHA256 and the `X-Ca-*`
  headers. HikCentral only pushes subscribed events to an HTTP(S) callback, so this adapter
  polls only when an installation supplies a documented `pollEndpoint`. Callback ingress
  belongs to the bridge HTTP server.

## ISAPI configuration

```json
{
  "mode": "isapi",
  "baseUrl": "http://192.0.2.20",
  "username": "fitcrm",
  "password": "...",
  "deviceId": "front-door"
}
```

Use a least-privileged device account and HTTPS when the device supports it. Endpoint overrides
must remain below `/ISAPI/`.

## HikCentral configuration

```json
{
  "mode": "hikcentral",
  "baseUrl": "https://hikcentral.example",
  "appKey": "...",
  "appSecret": "...",
  "pollEndpoint": "/artemis/api/acs/v1/door/events",
  "pollBody": {
    "pageNo": 1,
    "pageSize": 100,
    "startTime": "2026-07-23T00:00:00+05:00",
    "endTime": "2026-07-23T23:59:59+05:00"
  }
}
```

Without `pollEndpoint`, Bridge accepts HikCentral callback payloads at
`POST /vendor/hikvision`. The request must include
`X-FitCRM-Vendor-Key: <provider.ingressKey>` and the Bridge must listen on an address reachable
from the local reverse proxy. Keep Bridge on `127.0.0.1`; expose only an HTTPS reverse proxy
with a trusted certificate and an IP allowlist for the HikCentral server. Never send the
ingress key over plain HTTP or expose port 8787 directly to the network. The proxy must forward
only the exact `POST /vendor/hikvision` route; do not publish `/health`, `/doctor`, or a catch-all
upstream.

HikCentral endpoints are deliberately not guessed: configured paths must begin with
`/artemis/api/`, and HTTPS is required unless `allowInsecureHttp` is explicitly enabled for an
isolated legacy installation. Verify the exact endpoint and request body against the Developer
Guide installed with the same HikCentral version.

`createAdapter(config, deps)` returns `start(onEvent)`, `stop()`, `health()`, and
`testConnection()`. Credential-bearing events preserve the original vendor message only when
`includeRaw: true` and follow the bridge contract (`externalEventId`, `eventType`, `direction`,
`result`, `credentialUid`, `occurredAt`, `deviceId`, and `doorId`). Non-access camera events
without a credential are intentionally ignored. HikCentral poll results are de-duplicated by
their external event ID after successful durable enqueue.

Official references:

- Hikvision ISAPI `EventNotificationAlert` schema:
  https://open.hikvision.com/hardware/v2/XML%E6%96%87%E4%BB%B6/XML_EventNotificationAlert.html
- HikCentral Professional OpenAPI Developer Guide:
  https://enpinfo.hikvision.com/hkwsen/unzip/20260228113052_96832_doc/index.html
