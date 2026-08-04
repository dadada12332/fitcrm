import Link from "next/link"
import { CreditCard, LifeBuoy, Lock, LogOut } from "lucide-react"
import { signOut } from "@/app/(auth)/actions"
import { AppTranslationLayer } from "@/components/app/AppTranslationLayer"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppLocale } from "@/lib/app-locale"

export type SubscriptionLockReason = "suspended" | "trial" | "plan"

const LOCK_COPY: Record<SubscriptionLockReason, { title: string; text: string }> = {
  suspended: {
    title: "Клуб заблокирован",
    text: "Доступ к CRM приостановлен. Свяжитесь с поддержкой Zalkins для разблокировки.",
  },
  trial: {
    title: "Пробный период закончился",
    text: "Чтобы продолжить пользоваться Zalkins, оформите подписку или свяжитесь с поддержкой.",
  },
  plan: {
    title: "Подписка истекла",
    text: "Срок действия тарифа закончился. Продлите подписку, чтобы вернуть доступ к CRM.",
  },
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Пробный",
  starter: "Starter",
  standard: "Standard",
  business: "Business",
}

export function ServerSubscriptionLockScreen({
  reason,
  clubName,
  plan,
  locale,
  canManageSubscription,
}: {
  reason: SubscriptionLockReason
  clubName: string
  plan: string
  locale: AppLocale
  canManageSubscription: boolean
}) {
  const copy = LOCK_COPY[reason]
  const renewalLabel = reason === "trial"
    ? "Выбрать тариф"
    : `Продлить ${PLAN_LABELS[plan] ?? plan}`

  return (
    <>
      <AppTranslationLayer locale={locale} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
          <div className={`mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border ${
            reason === "suspended"
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-brand/25 bg-brand/10 text-brand"
          }`}>
            <Lock className="size-8" />
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{clubName}</p>
          <h1 className="mb-2 text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="mb-8 text-sm leading-6 text-muted-foreground">
            {copy.text}
            {!canManageSubscription && reason !== "suspended"
              ? " Владелец клуба уже может отправить заявку на продление."
              : ""}
          </p>
          <div className="flex flex-col gap-2.5">
            {reason !== "suspended" && canManageSubscription && (
              <Link href="/settings/subscription" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2")}>
                <CreditCard className="size-4" /> {renewalLabel}
              </Link>
            )}
            <Link href="/support" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 gap-2")}>
              <LifeBuoy className="size-4" /> Написать в поддержку
            </Link>
            <form action={signOut}>
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <LogOut className="size-3.5" /> Выйти
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
