"use client"

import { useState, useTransition } from "react"
import { ShieldCheck, ShieldMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PlatformRole, PlatformUserRow } from "@/lib/platform"
import {
  addPlatformAdminAction,
  changePlatformAdminRoleAction,
  removePlatformAdminAction,
} from "@/app/platform/(protected)/settings/actions"

const ROLE_LABEL: Record<PlatformRole, string> = {
  platform_admin: "Администратор",
  super_admin: "Суперадминистратор",
}

export function PlatformAdminsManager({
  admins,
  currentUserId,
}: {
  admins: PlatformUserRow[]
  currentUserId: string
}) {
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<PlatformRole>("platform_admin")

  const run = (work: () => Promise<{ ok?: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await work()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(success)
    })
  }

  return (
    <div className="space-y-4">
      <form
        action={(formData) => run(() => addPlatformAdminAction(formData), "Администратор добавлен")}
        className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]"
      >
        <Input
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email зарегистрированного пользователя"
          disabled={pending}
        />
        <input type="hidden" name="role" value={role} />
        <Select value={role} onValueChange={(value) => setRole(value as PlatformRole)} disabled={pending}>
          <SelectTrigger><SelectValue>{ROLE_LABEL[role]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="platform_admin">Администратор</SelectItem>
            <SelectItem value="super_admin">Суперадминистратор</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending}>
          <UserPlus className="size-4" />
          Добавить
        </Button>
      </form>

      <div className="divide-y divide-border rounded-lg border border-border">
        {admins.map((admin) => {
          const isSelf = admin.id === currentUserId
          const currentRole = admin.platformRole as PlatformRole
          return (
            <div key={admin.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(admin.fullName ?? admin.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{admin.fullName ?? "Без имени"}</p>
                    {isSelf && <Badge variant="secondary">Вы</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{admin.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={currentRole}
                  disabled={pending || isSelf}
                  onValueChange={(value) => run(
                    () => changePlatformAdminRoleAction(admin.id, value as PlatformRole),
                    "Роль обновлена",
                  )}
                >
                  <SelectTrigger className="w-[190px]">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <SelectValue>{ROLE_LABEL[currentRole]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_admin">Администратор</SelectItem>
                    <SelectItem value="super_admin">Суперадминистратор</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={pending || isSelf}
                  aria-label={`Удалить права ${admin.email ?? "администратора"}`}
                  onClick={() => run(() => removePlatformAdminAction(admin.id), "Доступ к платформе отозван")}
                >
                  <ShieldMinus className="size-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Администратор ведёт клубы, биллинг, подключения и поддержку. Суперадминистратор также управляет тарифами, промокодами, рассылками и доступом команды платформы.
      </p>
    </div>
  )
}
