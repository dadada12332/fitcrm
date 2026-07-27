"use client"

import { useState, useTransition } from "react"
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop2,
  Mail,
  Send,
  ShieldCheck,
  Unlink,
  UserRound,
  X,
} from "lucide-react"
import { AVATAR_PRESETS, resolveAvatarBackground, type AvatarMeta } from "@/lib/avatar"
import {
  disconnectProfileTelegramAction,
  signOutOtherSessionsAction,
  updateAvatarPresetAction,
  updateEmailAction,
  updatePasswordAction,
  updateProfileAction,
} from "./actions"
import { createTelegramStaffPairingAction } from "@/app/(app)/integrations/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Result = { ok: boolean; msg: string }

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  manager: "Менеджер",
  trainer: "Тренер",
  receptionist: "Ресепшен",
  staff: "Сотрудник",
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline gap-2 text-sm font-medium text-foreground">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function InlineResult({ result }: { result: Result }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        result.ok
          ? "border-chart-2/25 bg-chart-2/10 text-chart-2"
          : "border-destructive/25 bg-destructive/10 text-destructive"
      }`}
    >
      {result.ok && <CheckCircle2 className="size-4 shrink-0" />}
      {result.msg}
    </div>
  )
}

function AvatarCircle({
  meta,
  initials,
  size,
}: {
  meta: AvatarMeta
  initials: string
  size: number
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: resolveAvatarBackground(meta),
        fontSize: size * 0.32,
        letterSpacing: "-0.5px",
      }}
    >
      {initials}
    </div>
  )
}

function AvatarModal({
  initials,
  meta,
  onClose,
  onSaved,
}: {
  initials: string
  meta: AvatarMeta
  onClose: () => void
  onSaved: (next: AvatarMeta) => void
}) {
  const [local, setLocal] = useState<AvatarMeta>(meta)
  const [saving, startSave] = useTransition()
  const [result, setResult] = useState<Result | null>(null)

  function pickPreset(id: string) {
    const next: AvatarMeta = { preset: id, url: null }
    setLocal(next)
    setResult(null)
    startSave(async () => {
      const response = await updateAvatarPresetAction(id)
      if (response.ok) onSaved(next)
      else setResult({ ok: false, msg: response.error ?? "Не удалось изменить аватар" })
    })
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-foreground/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>Выберите аватар</CardTitle>
          <CardDescription>Цвет будет использоваться во всей CRM.</CardDescription>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <AvatarCircle meta={local} initials={initials} size={56} />
            <div>
              <p className="text-sm font-medium text-foreground">Предпросмотр</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Нажмите на цвет для выбора</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {AVATAR_PRESETS.map((preset) => {
              const active = local.preset === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => pickPreset(preset.id)}
                  title={preset.label}
                  disabled={saving}
                  className="relative flex h-12 items-center justify-center rounded-xl font-bold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                >
                  {initials}
                  {active && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand">
                      <Check className="size-2.5 text-primary-foreground" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {result && <InlineResult result={result} />}
        </CardContent>
      </Card>
    </div>
  )
}

type Props = {
  fullName: string
  email: string
  phone: string | null
  avatarPreset: string | null
  avatarUrl: string | null
  clubName: string
  role: string
  telegramConnected: boolean
  telegramId: string | null
}

export function ProfileClient({
  fullName,
  email,
  phone,
  avatarPreset,
  avatarUrl,
  clubName,
  role,
  telegramConnected,
  telegramId,
}: Props) {
  const [name, setName] = useState(fullName)
  const [tel, setTel] = useState(phone ?? "")
  const [avatarMeta, setAvatarMeta] = useState<AvatarMeta>({ preset: avatarPreset, url: avatarUrl })
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [profileResult, setProfileResult] = useState<Result | null>(null)
  const [profilePending, startProfile] = useTransition()

  const [connected, setConnected] = useState(telegramConnected)
  const [pairingUrl, setPairingUrl] = useState("")
  const [telegramResult, setTelegramResult] = useState<Result | null>(null)
  const [telegramPending, startTelegram] = useTransition()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordResult, setPasswordResult] = useState<Result | null>(null)
  const [passwordPending, startPassword] = useTransition()

  const [newEmail, setNewEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [emailResult, setEmailResult] = useState<Result | null>(null)
  const [emailPending, startEmail] = useTransition()

  const [sessionsResult, setSessionsResult] = useState<Result | null>(null)
  const [sessionsPending, startSessions] = useTransition()

  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?"

  function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setProfileResult(null)
    startProfile(async () => {
      const response = await updateProfileAction({ fullName: name, phone: tel })
      setProfileResult(response.ok
        ? { ok: true, msg: "Личные данные сохранены" }
        : { ok: false, msg: response.error ?? "Не удалось сохранить профиль" })
    })
  }

  function savePassword(event: React.FormEvent) {
    event.preventDefault()
    setPasswordResult(null)
    if (newPassword !== confirmPassword) {
      setPasswordResult({ ok: false, msg: "Пароли не совпадают" })
      return
    }
    startPassword(async () => {
      const response = await updatePasswordAction({ currentPassword, newPassword })
      if (response.ok) {
        setPasswordResult({ ok: true, msg: "Пароль изменён" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPasswordResult({ ok: false, msg: response.error ?? "Не удалось изменить пароль" })
      }
    })
  }

  function saveEmail(event: React.FormEvent) {
    event.preventDefault()
    setEmailResult(null)
    startEmail(async () => {
      const response = await updateEmailAction({ newEmail, password: emailPassword })
      if (response.ok) {
        setEmailResult({ ok: true, msg: "Подтверждение отправлено на новый адрес" })
        setNewEmail("")
        setEmailPassword("")
      } else {
        setEmailResult({ ok: false, msg: response.error ?? "Не удалось изменить email" })
      }
    })
  }

  function pairTelegram() {
    setTelegramResult(null)
    startTelegram(async () => {
      const response = await createTelegramStaffPairingAction()
      if (!response.ok || !response.pairingUrl) {
        setTelegramResult({ ok: false, msg: response.error ?? "Не удалось создать ссылку" })
        return
      }
      setPairingUrl(response.pairingUrl)
      setTelegramResult({ ok: true, msg: "Одноразовая ссылка действует 15 минут" })
    })
  }

  function disconnectTelegram() {
    setTelegramResult(null)
    startTelegram(async () => {
      const response = await disconnectProfileTelegramAction()
      if (response.ok) {
        setConnected(false)
        setPairingUrl("")
        setTelegramResult({ ok: true, msg: "Telegram отключён от профиля" })
      } else {
        setTelegramResult({ ok: false, msg: response.error ?? "Не удалось отключить Telegram" })
      }
    })
  }

  function signOutOtherSessions() {
    setSessionsResult(null)
    startSessions(async () => {
      const response = await signOutOtherSessionsAction()
      setSessionsResult(response.ok
        ? { ok: true, msg: "Другие сессии завершены" }
        : { ok: false, msg: response.error ?? "Не удалось завершить сессии" })
    })
  }

  return (
    <>
      {showAvatarModal && (
        <AvatarModal
          initials={initials}
          meta={avatarMeta}
          onClose={() => setShowAvatarModal(false)}
          onSaved={(next) => {
            setAvatarMeta(next)
            setShowAvatarModal(false)
          }}
        />
      )}

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="relative">
            <AvatarCircle meta={avatarMeta} initials={initials} size={72} />
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-sm hover:bg-brand/90"
              aria-label="Изменить аватар"
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-foreground">{name || "Без имени"}</h2>
              <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Building2 className="size-3.5" />
                {clubName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Аккаунт защищён
              </span>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowAvatarModal(true)}>
            <Camera className="size-4" />
            Изменить аватар
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
                <div>
                  <CardTitle>Личные данные</CardTitle>
                  <CardDescription>Имя и телефон используются в CRM и Telegram Mini App.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Имя и фамилия">
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Азиз Каримов" />
                  </Field>
                  <Field label="Телефон">
                    <Input
                      value={tel}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "")
                        if (!digits) {
                          setTel("")
                          return
                        }
                        const value = digits.startsWith("998") ? digits : `998${digits.replace(/^998/, "")}`
                        let masked = `+${value.slice(0, 3)}`
                        if (value.length > 3) masked += ` ${value.slice(3, 5)}`
                        if (value.length > 5) masked += ` ${value.slice(5, 8)}`
                        if (value.length > 8) masked += ` ${value.slice(8, 10)}`
                        if (value.length > 10) masked += ` ${value.slice(10, 12)}`
                        setTel(masked)
                      }}
                      placeholder="+998 90 000 00 00"
                      type="tel"
                      maxLength={17}
                    />
                  </Field>
                </div>
                <Field label="Email" hint="основной адрес входа">
                  <Input value={email} disabled />
                </Field>
                {profileResult && <InlineResult result={profileResult} />}
                <div className="flex justify-end">
                  <Button type="submit" disabled={profilePending}>
                    {profilePending ? "Сохраняю…" : "Сохранить изменения"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Send className="size-4" />
                </span>
                <div>
                  <CardTitle>Telegram Mini App</CardTitle>
                  <CardDescription>Рабочий кабинет автоматически подстраивается под вашу роль.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4 sm:flex-row sm:items-center">
                <span className={`size-2.5 shrink-0 rounded-full ${connected ? "bg-chart-2" : "bg-muted-foreground/40"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {connected ? "Telegram подключён" : "Telegram не подключён"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {connected
                      ? `Mini App доступен для роли «${ROLE_LABELS[role] ?? role}»${telegramId ? ` · ID ${telegramId}` : ""}`
                      : "Подключение занимает один клик и не требует номера телефона."}
                  </p>
                </div>
                {connected ? (
                  <Button type="button" variant="outline" onClick={disconnectTelegram} disabled={telegramPending}>
                    <Unlink className="size-4" />
                    Отключить
                  </Button>
                ) : (
                  <Button type="button" onClick={pairTelegram} disabled={telegramPending}>
                    <Send className="size-4" />
                    {telegramPending ? "Создаю ссылку…" : "Подключить Telegram"}
                  </Button>
                )}
              </div>
              {telegramResult && <InlineResult result={telegramResult} />}
              {pairingUrl && (
                <a href={pairingUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>
                  <Send className="size-4" />
                  Открыть Telegram
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="security" className="space-y-4 scroll-mt-20">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <KeyRound className="size-4" />
                </span>
                <div>
                  <CardTitle>Пароль</CardTitle>
                  <CardDescription>Единое место для смены пароля аккаунта.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePassword} className="space-y-4">
                <Field label="Текущий пароль">
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showCurrentPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Новый пароль">
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Минимум 8 символов"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((value) => !value)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Повторите пароль">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••"
                    />
                  </Field>
                </div>
                {passwordResult && <InlineResult result={passwordResult} />}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordPending ? "Меняю…" : "Изменить пароль"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Mail className="size-4" />
                </span>
                <div>
                  <CardTitle>Email для входа</CardTitle>
                  <CardDescription>На новый адрес придёт письмо подтверждения.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveEmail} className="space-y-4">
                <Field label="Новый email">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="new@email.com"
                  />
                </Field>
                <Field label="Подтвердите текущим паролем">
                  <Input
                    type="password"
                    value={emailPassword}
                    onChange={(event) => setEmailPassword(event.target.value)}
                    placeholder="Текущий пароль"
                  />
                </Field>
                {emailResult && <InlineResult result={emailResult} />}
                <div className="flex justify-end">
                  <Button type="submit" disabled={emailPending || !newEmail || !emailPassword}>
                    {emailPending ? "Отправляю…" : "Сменить email"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Laptop2 className="size-4" />
                </span>
                <div>
                  <CardTitle>Активные сессии</CardTitle>
                  <CardDescription>Текущее устройство останется в системе.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button type="button" variant="outline" onClick={signOutOtherSessions} disabled={sessionsPending}>
                {sessionsPending ? "Завершаю…" : "Выйти на других устройствах"}
              </Button>
              {sessionsResult && <InlineResult result={sessionsResult} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
