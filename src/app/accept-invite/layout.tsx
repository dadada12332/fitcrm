import { BrandLogo } from "@/components/brand/BrandLogo"

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden flex-1 flex-col bg-zinc-950 px-9 pb-8 pt-9 lg:flex">
        <BrandLogo href="/" inverse className="shrink-0" priority />
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
