"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { PlatformOperationalSettings as Settings } from "@/lib/platform"
import { savePlatformOperationalSettingsAction } from "@/app/platform/(protected)/settings/actions"

export function PlatformOperationalSettings({ initial }: { initial: Settings }) {
  const [registrationEnabled, setRegistrationEnabled] = useState(initial.registrationEnabled)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Новые регистрации</p>
          <p className="mt-0.5 text-xs text-muted-foreground">При выключении текущие пользователи продолжат входить.</p>
        </div>
        <Switch checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
      </div>
      <Button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await savePlatformOperationalSettingsAction({ registrationEnabled })
          if (result.error) toast.error(result.error)
          else toast.success("Операционные настройки сохранены")
        })}
      >
        {pending ? "Сохраняем…" : "Сохранить"}
      </Button>
    </div>
  )
}
