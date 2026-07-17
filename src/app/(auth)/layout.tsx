import Link from "next/link"
import { BrandingCarousel } from "./BrandingCarousel"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left dark branding panel */}
      <div className="hidden min-h-screen flex-1 flex-col overflow-hidden bg-foreground lg:flex" style={{ maxWidth: "52%" }}>
        <BrandingCarousel />
      </div>

      {/* Right white panel */}
      <div className="flex min-h-screen flex-1 flex-col bg-background">
        {children}
      </div>
    </div>
  )
}
