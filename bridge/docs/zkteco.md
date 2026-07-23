# ZKTeco adapter

The adapter polls a licensed ZKTeco server API (ZKBio CVSecurity, ZKBio Time,
or BioTime). It does not talk to terminals directly.

## Why paths are mandatory

ZKTeco publishes separate API documentation for its products and releases.
The product page confirms that CVSecurity exposes access-control and attendance
transaction REST interfaces, while ZKBio Time ships a separate API manual.
Authentication and resource paths are therefore intentionally not guessed by
the bridge. Copy `auth.path`, `events.path`, request body, token location and
query parameter names from the API manual supplied with the exact installed
and licensed version.

Official references:

- https://www.zkteco.com/en/ZKBio_CVSecurity0lN/ZKBio_CVSecurity
- https://www.zkteco.com/en/other_document (`ZKBio Time 9.0.6 API`, or the
  matching manual for the installed release)
- https://www.zkteco.com/en/faq.html (API access requires an API-enabled user
  and a valid API license)

## Example configuration

The placeholder paths below are not vendor endpoints. Replace them with paths
from the installed server's official API manual.

```js
{
  baseUrl: "https://zkbio.internal.example",
  auth: {
    mode: "token",
    path: "/PATH/FROM/OFFICIAL/MANUAL",
    body: { username: process.env.ZK_USER, password: process.env.ZK_PASSWORD },
    tokenPath: ["token"]
  },
  events: {
    path: "/PATH/FROM/OFFICIAL/MANUAL",
    query: {},
    // sinceParam: "NAME_FROM_OFFICIAL_MANUAL"
  },
  mapping: { profile: "zkbiotime-attendance" },
  pollIntervalMs: 5000
}
```

Available field profiles are `zkbio-cvsecurity-access`,
`zkbiotime-attendance`, and `biotime-attendance`. Use `custom` plus explicit
property paths when the installed release differs:

```js
mapping: {
  profile: "custom",
  list: ["data", "items"],
  id: ["id"],
  occurredAt: ["eventTime"],
  personId: ["person", "code"],
  deviceId: ["device", "serial"],
  result: ["status"],
  resultMap: {
    SUCCESS_CODE_FROM_INSTALLED_MANUAL: "allowed",
    DENIED_CODE_FROM_INSTALLED_MANUAL: "denied"
  },
  defaultResult: "unknown"
}
```

ZKBio Time/BioTime attendance transaction feeds are treated as confirmed reads. CVSecurity
access feeds stay fail-closed (`result: "unknown"`) until `mapping.resultMap` is filled with
the success/denial codes documented for the installed release. This prevents a denied attempt
from becoming a FitCRM visit.

Plain HTTP is rejected unless `allowInsecureHttp: true` is explicitly set for
an isolated trusted LAN. A response-shape mismatch rejects the complete page,
emits no partial batch, and appears in `health().lastError`.
