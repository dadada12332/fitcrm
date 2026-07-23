import Image from "next/image"
import { BrandingCarousel } from "./BrandingCarousel"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 clouds-anim">
          <Image
            src="/screens/clouds.jpg"
            alt=""
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
          />
        </div>
      </div>

      {/* Left branding panel */}
      <div className="relative z-10 hidden h-full min-h-0 w-1/2 flex-none flex-col overflow-hidden bg-foreground/45 lg:flex">
        <div className="relative z-10 h-full min-h-0 w-full">
          <BrandingCarousel />
        </div>
      </div>

      {/* Right cloud panel */}
      <div className="relative z-10 flex h-full min-h-0 w-full flex-none flex-col bg-foreground/45 lg:w-1/2">
        <div className="dark relative z-10 m-3 flex min-h-0 flex-1 flex-col overflow-auto rounded-3xl bg-background/25 shadow-2xl shadow-foreground/20 ring-1 ring-background/35 backdrop-blur-md backdrop-brightness-90 backdrop-saturate-75 lg:m-5">
          {children}
        </div>
      </div>
    </div>
  )
}
