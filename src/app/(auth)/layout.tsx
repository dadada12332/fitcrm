import Link from "next/link"
import { BrandingCarousel } from "./BrandingCarousel"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left dark branding panel */}
      <div className="hidden lg:flex flex-col flex-1 bg-[#0f172a] overflow-hidden" style={{ maxWidth: "52%", minHeight: "100vh" }}>
        <BrandingCarousel />
      </div>

      {/* Right white panel */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        {children}
      </div>
    </div>
  )
}
