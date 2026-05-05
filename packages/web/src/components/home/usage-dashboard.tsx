"use client"

import { ArrowDown, ArrowUp, Clock3, Cpu, DollarSign, TrendingUp, Zap, type LucideIcon } from "lucide-react"
import type { AgentUsageDashboard as AgentUsageDashboardData } from "@agent-spaces/shared"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function UsageDashboard({ data }: { data: AgentUsageDashboardData | null }) {
  const totals = data?.totals ?? {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    avgDurationMs: 0,
  }
  const daily = data?.daily ?? []
  const byModel = data?.byModel ?? []
  const recent = data?.recent ?? []
  const maxDailyTokens = Math.max(1, ...daily.map((item) => item.totalTokens))
  const maxModelCost = Math.max(1, ...byModel.map((item) => item.costUsd))

  return (
    <Card className="col-span-full gap-0 overflow-hidden rounded-lg py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="font-medium text-sm">Agent Usage</span>
        <Badge variant="secondary" className="h-5 rounded-full font-normal text-[10px]">
          {data?.periodLabel ?? "No data"}
        </Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <TrendingUp className="size-3 text-emerald-500" />
          <span className="text-muted-foreground text-xs">SQLite billing ledger</span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b sm:grid-cols-4">
        <Metric label="Agent Runs" value={formatNumber(totals.requests)} helper="completed runs" icon={Zap} />
        <Metric label="Tokens Used" value={formatTokens(totals.totalTokens)} helper={`${formatTokens(totals.inputTokens)} in`} icon={Cpu} />
        <Metric label="Total Cost" value={formatCurrency(totals.totalCostUsd)} helper="estimated spend" icon={DollarSign} />
        <Metric label="Avg Duration" value={formatDuration(totals.avgDurationMs)} helper="per run" icon={Clock3} last />
      </div>

      <div className="grid border-b lg:grid-cols-3">
        <div className="border-b p-4 lg:col-span-2 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-xs">Daily Token Usage</span>
            <div className="flex items-center gap-3">
              <Legend className="bg-foreground" label="Input" />
              <Legend className="bg-foreground/40" label="Output" />
            </div>
          </div>
          <div className="flex h-[132px] items-end gap-2 sm:gap-3">
            {daily.slice(-14).map((item) => {
              const inputHeight = Math.max(3, ((item.inputTokens / maxDailyTokens) * 100))
              const outputHeight = Math.max(3, (((item.inputTokens + item.outputTokens) / maxDailyTokens) * 100))
              return (
                <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {formatTokens(item.totalTokens)}
                  </span>
                  <div className="relative h-20 w-full">
                    <div className="absolute inset-x-0 bottom-0 h-full rounded-sm bg-muted/40" />
                    <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-foreground/40" style={{ height: `${outputHeight}%` }} />
                    <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-foreground" style={{ height: `${inputHeight}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              )
            })}
            {daily.length === 0 ? <EmptyBars /> : null}
          </div>
        </div>

        <div className="p-4">
          <span className="font-medium text-xs">Cost by Model</span>
          <div className="mt-3 space-y-2.5">
            {byModel.length === 0 ? (
              <p className="text-muted-foreground text-xs">No completed usage records yet.</p>
            ) : byModel.map((item, index) => (
              <div key={item.model} className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs">{item.model}</span>
                  <span className="font-mono text-xs font-semibold tabular-nums">{formatCurrency(item.costUsd)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", index === 0 ? "bg-foreground" : "bg-foreground/60")}
                    style={{ width: `${Math.max(4, (item.costUsd / maxModelCost) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="border-b p-4 md:border-r md:border-b-0">
          <span className="font-medium text-xs">Token Mix</span>
          <div className="mt-4 space-y-4">
            <UsageBar label="Input" value={totals.inputTokens} total={totals.totalTokens} />
            <UsageBar label="Output" value={totals.outputTokens} total={totals.totalTokens} muted />
          </div>
        </div>
        <div className="p-4">
          <span className="font-medium text-xs">Recent Agent Runs</span>
          <div className="mt-3">
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-xs">Usage appears here after an agent run completes.</p>
            ) : recent.map((item, index) => (
              <div key={item.id} className={cn("py-2", index < recent.length - 1 && "border-b")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs">{item.summary || item.role}</span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{formatCurrency(item.totalCostUsd)}</span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="h-4 max-w-32 rounded-full font-mono text-[9px]">
                    <span className="truncate">{item.model || "unknown"}</span>
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{formatTokens(item.totalTokens)} tok</span>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(item.completedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function Metric({ label, value, helper, icon: Icon, last }: { label: string; value: string; helper: string; icon: LucideIcon; last?: boolean }) {
  return (
    <div className={cn("px-4 py-3", !last && "border-r")}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="mt-1 font-semibold text-2xl tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-1">
        {label === "Total Cost" ? <ArrowDown className="size-3 text-emerald-500" /> : <ArrowUp className="size-3 text-emerald-500" />}
        <span className="text-muted-foreground text-[10px]">{helper}</span>
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className={cn("size-2 rounded-sm", className)} />
      {label}
    </span>
  )
}

function UsageBar({ label, value, total, muted }: { label: string; value: number; total: number; muted?: boolean }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px]">{label} tokens</span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", muted ? "bg-foreground/40" : "bg-foreground")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground tabular-nums">{formatNumber(value)}</div>
    </div>
  )
}

function EmptyBars() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      No token data
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return formatNumber(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value)
}

function formatDuration(value: number) {
  if (!value) return "0ms"
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value / 60_000)}m`
}

function formatRelative(value: string) {
  const delta = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(delta) || delta < 0) return "just now"
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
