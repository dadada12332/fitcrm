import Link from "next/link"

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden flex-1 flex-col bg-zinc-950 px-9 pb-8 pt-9 lg:flex">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="white" fillOpacity="0.12" />
            <path d="M7 12H17M12 7V17" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-xl" style={{ letterSpacing: "-0.12px" }}>fitCRM</span>
        </Link>
        <div className="mt-auto">
          <p className="text-white text-base leading-6 mb-2">
            &ldquo;Система помогла нам автоматизировать запись клиентов и увеличить выручку клуба за первые три месяца работы.&rdquo;
          </p>
          <p className="text-white font-medium text-sm">Алексей Иванов</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        {children}
      </div>
    </div>
  )
}
