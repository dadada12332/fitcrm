export const ACCESS_CONTROL_PROVIDERS = ["sigur", "zkteco", "hikvision"] as const

export type AccessControlProvider = (typeof ACCESS_CONTROL_PROVIDERS)[number]
export type AccessControlDirection = "entry" | "exit" | "unknown"
export type AccessControlResult = "allowed" | "denied" | "unknown"
export type AccessControlCredentialType = "card" | "bracelet" | "qr" | "face"

export const ACCESS_CONTROL_MODES: Record<AccessControlProvider, readonly string[]> = {
  sigur: ["web_delegation", "rest_poll", "bridge"],
  zkteco: ["zkbio", "bridge"],
  hikvision: ["hikcentral", "isapi", "bridge"],
}

export const ACCESS_CONTROL_PROVIDER_META = {
  sigur: {
    label: "Sigur",
    description: "Web Delegation и события прохода",
    verification: "Требуется активация протокола у Sigur и проверка на демостенде",
  },
  zkteco: {
    label: "ZKTeco",
    description: "ZKBio CVSecurity, ZKBio Time и BioTime",
    verification: "Требуется сверка версии ПО, API-лицензии и модели контроллера",
  },
  hikvision: {
    label: "Hikvision",
    description: "HikCentral OpenAPI или ISAPI через локальный мост",
    verification: "Требуется contract-тест на конкретной модели и firmware",
  },
} satisfies Record<AccessControlProvider, {
  label: string
  description: string
  verification: string
}>

export type AccessControlCredentialDTO = {
  id: string
  clientId: string
  clientName: string
  credentialType: AccessControlCredentialType
  credentialUid: string
  active: boolean
}

export type AccessControlEventDTO = {
  id: string
  externalEventId: string
  clientName: string | null
  credentialUid: string | null
  eventType: string
  direction: AccessControlDirection
  decision: "received" | "allowed" | "denied" | "ignored" | "error"
  reasonMessage: string | null
  occurredAt: string
}

export type AccessControlIntegrationDTO = {
  id: string
  provider: AccessControlProvider
  displayName: string
  mode: string
  status: "draft" | "configured" | "connected" | "error" | "disabled"
  baseUrl: string
  username: string
  hasSecret: boolean
  webhookKeyMask: string
  eventUrl: string
  decisionUrl: string
  lastSeenAt: string | null
  lastEventAt: string | null
  lastError: string | null
  credentials: AccessControlCredentialDTO[]
  events: AccessControlEventDTO[]
}

export type NormalizedAccessEvent = {
  externalEventId?: string
  eventType: "access_request" | "passage" | "denied" | "heartbeat" | "unknown"
  direction: AccessControlDirection
  result: AccessControlResult
  credentialUid?: string
  occurredAt: string
  deviceId?: string
  doorId?: string
  accessRequestId?: string
  simulated?: boolean
  payload?: Record<string, unknown>
}

export type AccessDecision = {
  allowed: boolean
  reasonCode: string
  reasonMessage: string
  clientId?: string
  clientName?: string
  subscriptionId?: string
  visitId?: string
  duplicate?: boolean
}
