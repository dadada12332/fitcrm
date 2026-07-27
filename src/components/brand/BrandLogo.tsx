import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  href?: string
  inverse?: boolean
  compact?: boolean
  quiet?: boolean
  navigationMark?: boolean
  priority?: boolean
}

export function BrandLogo({
  className,
  href,
  inverse = false,
  compact = false,
  quiet = false,
  navigationMark = false,
  priority = false,
}: BrandLogoProps) {
  const content = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center",
        className,
      )}
    >
      {navigationMark && !compact && (
        <Image
          src="/brand/zalkins-mobile-mark.png"
          alt=""
          width={128}
          height={128}
          priority={priority}
          className="mr-1.5 size-5 shrink-0 translate-y-px rounded-md object-contain sm:size-[18px]"
        />
      )}
      {compact ? (
        <Image
          src={inverse ? "/brand/zalkins-z-white.png" : "/brand/zalkins-z.png"}
          alt="zalkins"
          width={216}
          height={320}
          priority={priority}
          className="h-5 max-w-5 shrink-0 object-contain"
        />
      ) : (
        <span
          className={cn(
            "shrink-0 text-[22px] font-medium leading-none tracking-[-0.045em] sm:text-[24px]",
            inverse ? "text-white" : "text-foreground",
            quiet && "text-[17px] sm:text-[18px]",
            navigationMark && "text-[19px] sm:text-[20px]",
          )}
          style={{ fontFamily: "var(--font-serif)", fontStyle: "oblique 6deg" }}
        >
          zalkíns
        </span>
      )}
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} aria-label="zalkins" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  )
}

export function BrandMark({
  className,
  inverse = false,
  appIcon = false,
  priority = false,
}: {
  className?: string
  inverse?: boolean
  appIcon?: boolean
  priority?: boolean
}) {
  return (
    <Image
      src={
        appIcon
          ? "/brand/zalkins-app-icon.png"
          : inverse
            ? "/brand/zalkins-z-white.png"
            : "/brand/zalkins-z.png"
      }
      alt="zalkins"
      width={64}
      height={64}
      priority={priority}
      className={cn("size-8 object-contain", appIcon && "rounded-lg", className)}
    />
  )
}
