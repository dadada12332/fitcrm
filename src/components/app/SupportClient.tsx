"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Sparkles, MessageSquare, BookOpen } from "lucide-react"
import { KnowledgeClient } from "@/components/app/KnowledgeClient"
import { SupportTickets } from "@/components/app/SupportTickets"
import { SupportAi } from "@/components/app/SupportAi"

type TabKey = "ai" | "tickets" | "kb"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { key: "ai",      label: "AI Помощник", icon: Sparkles },
  { key: "tickets", label: "Обращения",   icon: MessageSquare },
  { key: "kb",      label: "База знаний",  icon: BookOpen },
]

export function SupportClient({ clubId, initialTab = "ai" }: { clubId: string; initialTab?: TabKey }) {
  const params = useSearchParams()
  const router = useRouter()
  const urlTab = (params.get("tab") as TabKey) || initialTab
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === urlTab) ? urlTab : "ai")
  const articleId = params.get("article") ?? undefined

  useEffect(() => {
    // Browser navigation can update the selected support tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(TABS.some((t) => t.key === urlTab) ? urlTab : "ai")
  }, [urlTab])

  function go(next: TabKey) {
    setTab(next)
    const sp = new URLSearchParams(Array.from(params.entries()))
    sp.set("tab", next)
    if (next !== "tickets") sp.delete("id")
    router.replace(`/support?${sp.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.144px]" style={{ color: "var(--on-dark)" }}>Поддержка</h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-dark-soft)" }}>
          Спросите AI, откройте обращение или найдите ответ в базе знаний
        </p>
      </div>

      {/* Вкладки */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <nav className="flex min-w-0 items-end" style={{ gap: 0 }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => go(key)}
                className="relative flex shrink-0 items-center gap-1.5 px-1.5 text-xs transition-colors sm:gap-2 sm:px-3.5 sm:text-sm"
                style={{
                  height: 44,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#2563eb" : "var(--on-dark-soft)",
                  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <span className="hidden sm:block">
                  <Icon style={{ width: 15, height: 15, color: active ? "#2563eb" : "var(--gray-muted)" }} />
                </span>
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      <div>
        {tab === "ai" && <SupportAi onCreateTicket={() => go("tickets")} />}
        {tab === "tickets" && <SupportTickets clubId={clubId} />}
        {tab === "kb" && <KnowledgeClient initialArticleId={articleId} />}
      </div>
    </div>
  )
}
