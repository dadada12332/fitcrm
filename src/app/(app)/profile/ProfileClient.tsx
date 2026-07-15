"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Eye, EyeOff, Check, Camera, X } from "lucide-react"
import { AVATAR_PRESETS, resolveAvatarBackground, type AvatarMeta } from "@/lib/avatar"
import {
  updateProfileAction,
  updateAvatarPresetAction,
  updatePasswordAction,
  updateEmailAction,
} from "./actions"

// ── design primitives ─────────────────────────────────────────────

const S = { background: "var(--card)", border: "1px solid var(--border)", color: "var(--on-dark)" }

function FInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...p}
      className="h-10 w-full rounded-lg px-3 text-sm outline-none transition-colors"
      style={{ ...S, ...(p.style ?? {}) }}
    />
  )
}

function FLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-1.5">
      <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>{children}</p>
      {hint && <span className="text-xs" style={{ color: "var(--gray-muted)" }}>{hint}</span>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold mb-4" style={{ color: "var(--on-dark-soft)" }}>{children}</p>
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0" }} />
}

function Toast({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium"
      style={{
        background: ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
        border: `1px solid ${ok ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
        color: ok ? "#16a34a" : "#dc2626",
      }}>
      {ok && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
      {msg}
    </div>
  )
}

function SaveBtn({ pending, label, pendingLabel = "Сохранение..." }: { pending: boolean; label: string; pendingLabel?: string }) {
  return (
    <button type="submit" disabled={pending}
      className="h-9 px-5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "#2563eb" }}>
      {pending ? pendingLabel : label}
    </button>
  )
}

// ── Avatar display ────────────────────────────────────────────────

function AvatarCircle({ meta, initials, size }: { meta: AvatarMeta; initials: string; size: number }) {
  return (
    <div className="flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        borderRadius: size * 0.22,
        background: resolveAvatarBackground(meta),
        fontSize: size * 0.32,
        letterSpacing: "-0.5px",
      }}>
      {initials}
    </div>
  )
}

// ── Avatar picker modal ───────────────────────────────────────────

function AvatarModal({
  initials, meta, onClose, onSaved,
}: {
  initials: string
  meta: AvatarMeta
  onClose: () => void
  onSaved: (next: AvatarMeta) => void
}) {
  const [local, setLocal] = useState<AvatarMeta>(meta)
  const [saving, startSave] = useTransition()
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)

  async function pickPreset(id: string) {
    const next: AvatarMeta = { preset: id, url: null }
    setLocal(next); setRes(null)
    startSave(async () => {
      const r = await updateAvatarPresetAction(id)
      if (r.ok) { onSaved(next) }
      else        setRes({ ok: false, msg: r.error ?? "Ошибка" })
    })
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative rounded-2xl p-6 w-full" style={{ maxWidth: 380, background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-base font-semibold" style={{ color: "var(--on-dark)" }}>Выберите аватар</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--on-dark-soft)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-4 mb-5">
          <AvatarCircle meta={local} initials={initials} size={56} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--on-dark)" }}>Предпросмотр</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>Нажмите на цвет для выбора</p>
          </div>
        </div>

        {/* Presets grid */}
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_PRESETS.map((p) => {
            const active = local.preset === p.id
            return (
              <button key={p.id} onClick={() => pickPreset(p.id)} title={p.label} disabled={saving}
                className="relative flex items-center justify-center text-white font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{
                  height: 52, borderRadius: 12,
                  background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                  outline: active ? "2.5px solid #2563eb" : "none",
                  outlineOffset: 2,
                  fontSize: 15,
                }}>
                {initials}
                {active && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {res && <div className="mt-3"><Toast ok={res.ok} msg={res.msg} /></div>}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

type Props = {
  fullName: string; email: string; phone: string | null
  avatarPreset: string | null; avatarUrl: string | null
}

export function ProfileClient({ fullName, email, phone, avatarPreset, avatarUrl }: Props) {
  const [name, setName]   = useState(fullName)
  const [tel,  setTel]    = useState(phone ?? "")
  const [avatarMeta, setAvatarMeta] = useState<AvatarMeta>({ preset: avatarPreset, url: avatarUrl })
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [pRes,  setPRes]  = useState<{ ok: boolean; msg: string } | null>(null)
  const [pPend, startP]   = useTransition()

  // password
  const [curPwd,  setCurPwd]  = useState("")
  const [newPwd,  setNewPwd]  = useState("")
  const [confPwd, setConfPwd] = useState("")
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwRes,   setPwRes]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [pwPend,  startPw]    = useTransition()

  // email
  const [newEmail, setNewEmail] = useState("")
  const [emailPwd, setEmailPwd] = useState("")
  const [emailRes, setEmailRes] = useState<{ ok: boolean; msg: string } | null>(null)
  const [emailPend, startEmail] = useTransition()

  const initials = name.trim().split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?"

  function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setPRes(null)
    startP(async () => {
      const r = await updateProfileAction({ fullName: name, phone: tel })
      setPRes(r.ok ? { ok: true, msg: "Профиль сохранён" } : { ok: false, msg: r.error ?? "Ошибка" })
    })
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault(); setPwRes(null)
    if (newPwd !== confPwd) { setPwRes({ ok: false, msg: "Пароли не совпадают" }); return }
    startPw(async () => {
      const r = await updatePasswordAction({ currentPassword: curPwd, newPassword: newPwd })
      if (r.ok) { setPwRes({ ok: true, msg: "Пароль изменён" }); setCurPwd(""); setNewPwd(""); setConfPwd("") }
      else        setPwRes({ ok: false, msg: r.error ?? "Ошибка" })
    })
  }

  function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setEmailRes(null)
    startEmail(async () => {
      const r = await updateEmailAction({ newEmail, password: emailPwd })
      if (r.ok) { setEmailRes({ ok: true, msg: "Письмо отправлено на новый адрес" }); setNewEmail(""); setEmailPwd("") }
      else        setEmailRes({ ok: false, msg: r.error ?? "Ошибка" })
    })
  }

  return (
    <>
      {showAvatarModal && (
        <AvatarModal
          initials={initials}
          meta={avatarMeta}
          onClose={() => setShowAvatarModal(false)}
          onSaved={(next) => { setAvatarMeta(next); setShowAvatarModal(false) }}
        />
      )}

      {/* ── Two-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: identity card ── */}
        <div className="flex-shrink-0 w-56 rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="relative">
            <AvatarCircle meta={avatarMeta} initials={initials} size={80} />
            <button
              onClick={() => setShowAvatarModal(true)}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md transition-opacity hover:opacity-80"
              style={{ background: "#2563eb" }}>
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--on-dark)" }}>
              {name || "—"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray-muted)" }}>{email}</p>
          </div>
          <button
            onClick={() => setShowAvatarModal(true)}
            className="w-full h-8 rounded-lg text-xs font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ border: "1px solid var(--border)", color: "var(--on-dark-soft)" }}>
            Изменить аватар
          </button>
        </div>

        {/* ── Right: forms ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Personal data */}
          <form onSubmit={saveProfile}
            className="rounded-2xl p-5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <SectionTitle>Личные данные</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FLabel>Имя и фамилия</FLabel>
                  <FInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Азиз Каримов" />
                </div>
                <div>
                  <FLabel>Телефон</FLabel>
                  <FInput
                    value={tel}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "")
                      let masked = ""
                      if (digits.length === 0) { masked = ""; }
                      else {
                        const d = digits.startsWith("998") ? digits : "998" + digits.replace(/^998/, "")
                        masked = "+" + d.slice(0, 3)
                        if (d.length > 3)  masked += " " + d.slice(3, 5)
                        if (d.length > 5)  masked += " " + d.slice(5, 8)
                        if (d.length > 8)  masked += " " + d.slice(8, 10)
                        if (d.length > 10) masked += " " + d.slice(10, 12)
                      }
                      setTel(masked)
                    }}
                    placeholder="+998 90 000 00 00"
                    type="tel"
                    maxLength={17}
                  />
                </div>
              </div>
              <div>
                <FLabel hint="(только для просмотра)">Email</FLabel>
                <FInput value={email} disabled style={{ opacity: 0.45, cursor: "not-allowed" }} />
              </div>
              {pRes && <Toast ok={pRes.ok} msg={pRes.msg} />}
              <div className="flex justify-end pt-1">
                <SaveBtn pending={pPend} label="Сохранить" />
              </div>
            </div>
          </form>

          {/* Security */}
          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <SectionTitle>Безопасность</SectionTitle>

            {/* Change password */}
            <form onSubmit={savePassword} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gray-muted)" }}>Смена пароля</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FLabel>Текущий</FLabel>
                  <div className="relative">
                    <FInput type={showCur ? "text" : "password"} value={curPwd} onChange={(e) => setCurPwd(e.target.value)} placeholder="••••••••" style={{ paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }}>
                      {showCur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <FLabel>Новый</FLabel>
                  <div className="relative">
                    <FInput type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Мин. 8 символов" style={{ paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--gray-muted)" }}>
                      {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <FLabel>Повторите</FLabel>
                  <FInput type="password" value={confPwd} onChange={(e) => setConfPwd(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              {pwRes && <Toast ok={pwRes.ok} msg={pwRes.msg} />}
              <div className="flex justify-end">
                <SaveBtn pending={pwPend} label="Изменить пароль" pendingLabel="Смена..." />
              </div>
            </form>

            <Divider />

            {/* Change email */}
            <form onSubmit={saveEmail} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gray-muted)" }}>Смена Email</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FLabel>Новый email</FLabel>
                  <FInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" />
                </div>
                <div>
                  <FLabel>Подтвердите паролем</FLabel>
                  <FInput type="password" value={emailPwd} onChange={(e) => setEmailPwd(e.target.value)} placeholder="Текущий пароль" />
                </div>
              </div>
              {emailRes && <Toast ok={emailRes.ok} msg={emailRes.msg} />}
              <div className="flex justify-end">
                <SaveBtn pending={emailPend} label="Сменить email" pendingLabel="Отправка..." />
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  )
}
