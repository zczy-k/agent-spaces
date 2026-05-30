import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PERIOD_KEYS } from "./usage-dashboard-utils"

export function DashboardSkeleton() {
  return (
    <Card className="col-span-full gap-0 overflow-hidden rounded-lg py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-1">
          {PERIOD_KEYS.map(opt => (
            <Skeleton key={opt.key} className="h-5 w-8 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 border-b sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="grid border-b lg:grid-cols-3">
        <div className="border-b p-4 lg:col-span-2 lg:border-r lg:border-b-0">
          <Skeleton className="h-3 w-24 mb-3" />
          <div className="flex h-[132px] items-end gap-2">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-16 w-full rounded-sm" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <Skeleton className="h-3 w-20 mb-3" />
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
      </div>
    </Card>
  )
}
