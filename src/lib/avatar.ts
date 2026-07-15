export type AvatarPreset = {
  id: string
  from: string
  to: string
  label: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "1",  from: "#6366f1", to: "#8b5cf6", label: "Индиго"    },
  { id: "2",  from: "#ef4444", to: "#f97316", label: "Закат"     },
  { id: "3",  from: "#10b981", to: "#0d9488", label: "Изумруд"   },
  { id: "4",  from: "#ec4899", to: "#f43f5e", label: "Роза"      },
  { id: "5",  from: "#f59e0b", to: "#ef4444", label: "Огонь"     },
  { id: "6",  from: "#3b82f6", to: "#06b6d4", label: "Океан"     },
  { id: "7",  from: "#1e293b", to: "#475569", label: "Ночь"      },
  { id: "8",  from: "#84cc16", to: "#10b981", label: "Весна"     },
  { id: "9",  from: "#a855f7", to: "#ec4899", label: "Галактика" },
  { id: "10", from: "#0ea5e9", to: "#6366f1", label: "Рассвет"   },
]

export function getPresetGradient(presetId: string): string {
  const p = AVATAR_PRESETS.find((a) => a.id === presetId)
  return p ? `linear-gradient(135deg, ${p.from}, ${p.to})` : "linear-gradient(135deg, #6366f1, #8b5cf6)"
}

export type AvatarMeta = {
  preset: string | null   // "1".."10"
  url: string | null      // custom uploaded URL
}

export function parseAvatarMeta(userMetadata: Record<string, unknown> | null): AvatarMeta {
  if (!userMetadata) return { preset: null, url: null }
  return {
    preset: (userMetadata.avatar_preset as string) ?? null,
    url:    (userMetadata.avatar_url    as string) ?? null,
  }
}

export function resolveAvatarBackground(meta: AvatarMeta): string {
  if (meta.preset) return getPresetGradient(meta.preset)
  return "linear-gradient(135deg, #6366f1, #8b5cf6)"
}
