import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  href?: string
  inverse?: boolean
  compact?: boolean
  priority?: boolean
}

export function BrandLogo({
  className,
  href,
  inverse = false,
  compact = false,
  priority = false,
}: BrandLogoProps) {
  const content = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2",
        inverse ? "text-white" : "text-foreground",
        className,
      )}
    >
      <Image
        src={inverse ? "/brand/zalkins-mark-white.png" : "/brand/zalkins-mark.png"}
        alt=""
        width={36}
        height={36}
        priority={priority}
        className={cn("size-8 shrink-0 object-contain", compact && "size-7")}
      />
      {!compact && (
        <span className="truncate text-[19px] font-semibold leading-none tracking-[-0.035em]">
          Zalkins
        </span>
      )}
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} aria-label="Zalkins" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
            ? "/brand/zalkins-mark-white.png"
            : "/brand/zalkins-mark.png"
      }
      alt="Zalkins"
      width={64}
      height={64}
      priority={priority}
      className={cn("size-8 object-contain", appIcon && "rounded-lg", className)}
    />
  )
}
