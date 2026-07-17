"use client"

import { useActionState } from "react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { platformSignIn, type PlatformLoginState } from "@/app/platform/login/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState<PlatformLoginState, FormData>(platformSignIn, {})

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">FitCRM Platform</p>
            <p className="text-xs text-muted-foreground">Управление SaaS</p>
          </div>
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Вход администратора</CardTitle>
            <CardDescription>Используйте аккаунт platform_admin или super_admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={action} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="platform-email">Email</label>
                <Input id="platform-email" name="email" type="email" autoComplete="username" placeholder="admin@fitcrm.uz" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="platform-password">Пароль</label>
                <Input id="platform-password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
              </div>

              {state.error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={pending} className="w-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {pending ? "Проверка..." : "Войти в Platform"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">Все административные действия журналируются.</p>
      </div>
    </main>
  )
}
