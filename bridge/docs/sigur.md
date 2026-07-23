# Sigur adapter

The adapter uses Sigur's documented Public REST API:

- API root: `http://<Sigur server>:9500/api/v1`
- authentication: `POST /users/auth`
- event polling: `GET /events` with the `lastId` cursor
- maximum documented REST page size: 3000 records

Reference: [Public REST API Developer's Guide](https://sigur.com/doc/Public_REST_API_Developers_Guide.pdf).

## Configuration

```js
{
  baseUrl: "http://192.168.1.10:9500",
  username: "fitcrm-bridge",
  password: "...",
  pollIntervalMs: 5000,
  batchSize: 100,
  replayExisting: false,
  eventMap: {
    credentialUid: "siteSpecific.cardUid"
  }
}
```

`token` can replace `username`/`password` when the token lifecycle is managed
outside the adapter. JWTs issued by Sigur normally expire after one hour, so
username/password is recommended for unattended operation.

`replayExisting` defaults to `false`: the first poll establishes the latest
event cursor, then only new records are emitted. Set it to `true`, optionally
with `initialCursor`, to import existing records.

`eventMap.credentialUid` is mandatory and intentionally has no default.
Sigur's documented `/events` response exposes `accessObjectId`, but does not
describe it as a card or bracelet UID. A site may explicitly choose
`"accessObjectId"` only if that identifier is also what was registered as the
FitCRM credential.

For installations behind a reverse proxy, `apiBasePath`, `authPath`, and
`eventsPath` are configurable. `eventQuery` adds/replaces query parameters.
`eventMap` maps a site-specific payload into canonical bridge fields:

```js
{
  eventMap: {
    externalEventId: "id",
    credentialUid: "data.cardUid",
    occurredAt: "timestamp",
    deviceId: "accessPointId"
  }
}
```

Numeric Sigur event type codes are not guessed. Configure `eventTypes`, for
example `{ "6": "passage" }`, only after verifying the event type with the
installed server's `GET /events/types` response. Likewise, `results` can map a
site-specific source value into `allowed` or `denied`.

Raw event payloads are excluded by default. Set `includeRaw: true` only when
the receiving side is allowed to retain all access-control data.

## Web Delegation

Sigur's public product documentation confirms that Web Delegation sends
HTTP(S) POST requests with UTF-8 JSON from the Sigur service to an external
system. It does not publish the exact request and response schema. The adapter
therefore reports Web Delegation as unsupported instead of guessing a wire
contract. Implement an inbound handler only after obtaining the matching
protocol guide from Sigur support.

Reference: [Delegation to third-party systems](https://sigur.com/en/features/decision_delegation/).
