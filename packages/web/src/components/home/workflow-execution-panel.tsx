"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from 'next-intl'
import {
  CheckCircle2, Clock, GitBranch, Loader2, Play, XCircle,
  AlertTriangle, Pause, ChevronRight,
} from "lucide-react"
import type { ExecutionLog } from "@agent-spaces/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { executionLogApi } from "@/lib/workflow-api"
import { formatDuration } from "./usage-dashboard-utils"

// ---- Status badge ----

function statusBadge(status: ExecutionLog['status']) {
  const map: Record<string, { icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    running:   { icon: Loader2, variant: "default", label: "Running" },
    completed: { icon: CheckCircle2, variant: "secondary", label: "Completed" },
    paused:    { icon: Pause, variant: "outline", label: "Paused" },
    error:     { icon: XCircle, variant: "destructive", label: "Error" },
  }
  const cfg = map[status] ?? map.error
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px] font-normal">
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </Badge>
  )
}

// ---- Stats cards ----

function StatsCards({ logs }: { logs: (ExecutionLog & { workflowName?: string })[] }) {
  const total = logs.length
  const running = logs.filter(l => l.status === 'running').length
  const completed = logs.filter(l => l.status === 'completed').length
  const failed = logs.filter(l => l.status === 'error').length
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const cards = [
    { label: "Total Runs", value: total, icon: Play },
    { label: "Running", value: running, icon: Loader2 },
    { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2 },
    { label: "Failed", value: failed, icon: AlertTriangle },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(c => (
        <Card key={c.label} className="gap-2 py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---- Execution history table ----

function formatTime(ts: number) {
  if (!ts) return "-"
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function getDuration(log: ExecutionLog) {
  if (!log.startedAt) return "-"
  const end = log.finishedAt || Date.now()
  const ms = end - log.startedAt
  return formatDuration(ms)
}

// ---- Main component ----

export function WorkflowExecutionPanel() {
  const t = useTranslations('home')
  const [logs, setLogs] = useState<(ExecutionLog & { workflowName?: string })[] | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const data = await executionLogApi.listAll(50)
      setLogs(data)
    } catch {
      setLogs([])
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (logs === null) {
    return (
      <Card className="gap-0 overflow-hidden rounded-lg py-0">
        <CardHeader className="border-b px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-lg py-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Workflow Executions</span>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchLogs}>
          <Clock className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="border-b p-4">
        <StatsCards logs={logs} />
      </div>

      {logs.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          No workflow executions yet
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Workflow</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Started</TableHead>
              <TableHead className="text-xs">Duration</TableHead>
              <TableHead className="text-xs">Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} className="group cursor-pointer">
                <TableCell className="max-w-[200px] truncate text-xs font-medium">
                  <div className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    {log.workflowName || log.workflowId}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{statusBadge(log.status)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatTime(log.startedAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{getDuration(log)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.steps?.length ?? 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
