import Link from "next/link"
import { MessageCircle, BookOpen, Mail, ExternalLink } from "lucide-react"

export const metadata = { title: "Поддержка — FitCRM" }

export default function SupportPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Поддержка</h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
          Мы всегда готовы помочь
        </p>
      </div>

      <div className="grid gap-3">
        <Link href="/knowledge"
          className="flex items-center gap-4 p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(37,99,235,0.12)" }}>
            <BookOpen size={22} style={{ color: "#2563eb" }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--on-dark)" }}>База знаний</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
              Инструкции, сценарии и ответы на частые вопросы
            </div>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0" style={{ color: "var(--on-dark-soft)" }} />
        </Link>

        <a href="https://t.me/fitcrm_support" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(44,165,224,0.12)" }}>
            <MessageCircle size={22} style={{ color: "#2ca5e0" }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--on-dark)" }}>Telegram-поддержка</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
              Ответим в течение 2 часов в рабочее время
            </div>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0" style={{ color: "var(--on-dark-soft)" }} />
        </a>

        <a href="mailto:support@fitcrm.uz"
          className="flex items-center gap-4 p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(16,185,129,0.12)" }}>
            <Mail size={22} style={{ color: "#10b981" }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--on-dark)" }}>Email</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--on-dark-soft)" }}>
              support@fitcrm.uz — для нетерпящих вопросов
            </div>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0" style={{ color: "var(--on-dark-soft)" }} />
        </a>
      </div>

      <div className="mt-6 p-5 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-sm font-semibold mb-3" style={{ color: "var(--on-dark)" }}>Написать нам</div>
        <form className="space-y-3">
          <textarea
            placeholder="Опишите вашу проблему или вопрос..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: "var(--card-2)", border: "1px solid var(--border)", color: "var(--on-dark)" }}
          />
          <button type="submit"
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#2563eb", color: "white" }}>
            Отправить обращение
          </button>
        </form>
      </div>

      <div className="mt-4 text-center text-xs" style={{ color: "var(--on-dark-soft)" }}>
        Рабочее время поддержки: Пн–Пт 9:00–18:00 (UTC+5)
      </div>
    </div>
  )
}
