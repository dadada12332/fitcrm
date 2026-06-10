import Link from "next/link"
import { Zap } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--orange)" }}>
            <Zap className="w-5 h-5 text-white" fill="white" />
          </span>
          <span className="text-xl text-white" style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
            FitCRM
          </span>
        </Link>

        <div
          className="rounded-3xl p-8 md:p-10"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
