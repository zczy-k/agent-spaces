import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PERIOD_KEYS } from "./usage-dashboard-utils"

export function DashboardSkeleton() {
  return (
    <div className="col-span-full flex flex-col gap-3">
      {/* Header + Metrics */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-1">
            {PERIOD_KEYS.map(opt => (
              <Skeleton key={opt.key} className="h-5 w-8 rounded-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Card>

      {/* Activity */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <div className="p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-[132px] w-full rounded-sm" />
          </div>
        </Card>
        <Card className="gap-0 py-0">
          <div className="p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <div className="flex h-[132px] items-end gap-2">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-16 w-full rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="gap-0 py-0">
          <div className="p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="gap-0 py-0">
          <div className="p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="mx-auto h-40 w-full rounded-full" />
          </div>
        </Card>
        <Card className="gap-0 py-0">
          <div className="p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="mx-auto h-40 w-full rounded-full" />
          </div>
        </Card>
      </div>
    </div>
  )
}
