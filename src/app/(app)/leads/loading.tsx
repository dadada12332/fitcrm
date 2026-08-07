function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-muted ${className}`} />
}

export default function LeadsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Загрузка лидов">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-32 max-w-full" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:flex-nowrap lg:items-center">
          <Skeleton className="h-10 min-w-0 flex-1 lg:max-w-sm" />
          <Skeleton className="h-9 w-full lg:w-96" />
          <Skeleton className="h-9 w-full lg:w-24" />
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-36 w-full" />)}
        </div>
        <div className="hidden md:block">
          <Skeleton className="m-4 h-10 w-[calc(100%-2rem)]" />
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="mx-4 mb-3 h-14 w-[calc(100%-2rem)]" />
          ))}
        </div>
      </div>
    </div>
  )
}
