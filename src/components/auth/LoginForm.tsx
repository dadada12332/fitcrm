"use client"

import { useActionState, useState, useTransition } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { signInWithEmail, signInWithGoogle, type AuthState } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

function GoogleButton({ next }: { next?: string }) {
  const [pending, start] = useTransition()
  return (
    <Button type="button" variant="outline" size="lg" disabled={pending}
      onClick={() => { const fd = new FormData(); if (next) fd.append("next", next); start(() => signInWithGoogle(fd)) }}
      className="h-10 w-full gap-2.5 border-border/70 bg-background/55 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/80">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
      </svg>
      {pending ? "Переходим..." : "Продолжить через Google"}
    </Button>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithEmail, {})
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end px-9 pt-9">
        <Link href="/register" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/45">
          Нет аккаунта? <span className="font-semibold">Зарегистрироваться</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-6 sm:px-10 lg:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-7 text-left">
            <h1 className="mb-2 text-3xl font-semibold text-foreground">
              С возвращением!
            </h1>
            <p className="text-base text-foreground/80">Войдите в свой аккаунт fitCRM</p>
          </div>

          <form action={action} className="flex flex-col gap-5">
            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-2">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email
                </label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" autoFocus required className="border-foreground/15 bg-background/30 shadow-none backdrop-blur-sm placeholder:text-foreground/50 focus-visible:bg-background/50 focus-visible:ring-ring/30" />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Пароль
                </label>
                <div className="relative">
                  <Input id="password" name="password" type={showPw ? "text" : "password"} placeholder="••••••••" required className="border-foreground/15 bg-background/30 pr-10 shadow-none backdrop-blur-sm placeholder:text-foreground/50 focus-visible:bg-background/50 focus-visible:ring-ring/30" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                    aria-pressed={showPw}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <Checkbox name="rememberMe" aria-label="Запомнить меня" />
                <span className="text-sm text-foreground/80">Запомнить меня</span>
              </label>
              <Link href="/forgot-password" className="shrink-0 text-sm text-foreground/80 hover:text-foreground hover:underline">
                Забыли пароль?
              </Link>
            </div>

            {state.error && (
              <p className="text-center text-sm text-destructive" role="alert">{state.error}</p>
            )}

            <div className="flex flex-col gap-3">
              <Button type="submit" size="lg" disabled={pending} className="h-10 w-full">
                {pending ? "Входим..." : "Войти"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-foreground/70">или</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleButton next={next} />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
