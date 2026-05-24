"use client";

import { format } from "date-fns";
import type { GitLogEntry } from "@agent-spaces/shared";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { GitCommitContextMenu } from "./git-commit-context-menu";

interface Props {
  workspaceId: string;
  log: GitLogEntry[];
  currentHeadHash?: string;
  currentBranch?: string;
  onSelectEntry: (entry: GitLogEntry) => void;
  onRefreshAll: () => void;
  onOpenPrompt: (title: string, label: string, placeholder: string, onSubmit: (v: string) => void) => void;
}

function parseCommitType(message: string) {
  const firstLine = message.split("\n")[0];
  const match = firstLine.match(/^(\w+)(?:\([\w-]+\))?(!)?:/);
  if (!match) return { label: "Other", variant: "outline" as const };

  const type = match[1].toLowerCase();
  const isBreaking = !!match[2];

  if (isBreaking) return { label: "Breaking", variant: "destructive" as const };

  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    feat: { label: "Feature", variant: "default" },
    fix: { label: "Fix", variant: "secondary" },
    refactor: { label: "Refactor", variant: "outline" },
    perf: { label: "Perf", variant: "outline" },
    docs: { label: "Docs", variant: "outline" },
    test: { label: "Test", variant: "outline" },
    chore: { label: "Chore", variant: "outline" },
    ci: { label: "CI", variant: "outline" },
    build: { label: "Build", variant: "outline" },
  };

  const entry = map[type];
  if (entry) return entry;
  return { label: type.charAt(0).toUpperCase() + type.slice(1), variant: "outline" as const };
}

function stripPrefix(message: string) {
  const firstLine = message.split("\n")[0];
  return firstLine.replace(/^\w+(?:\([\w-]+\))?!?:\s*/, "") || firstLine;
}

export function GitCommitLogList({ workspaceId, log, currentHeadHash, currentBranch, onSelectEntry, onRefreshAll, onOpenPrompt }: Props) {
  return (
    <div>
      {log.map((entry) => {
        const { label, variant } = parseCommitType(entry.message);
        const title = stripPrefix(entry.message);
        const shortHash = entry.hash.slice(0, 7);
        const isCurrentHead = Boolean(currentHeadHash)
          && (entry.hash.startsWith(currentHeadHash!) || currentHeadHash!.startsWith(entry.hash));

        return (
          <ContextMenu key={entry.hash}>
            <ContextMenuTrigger>
              <div
                onClick={() => onSelectEntry(entry)}
                className={cn(
                  "flex items-center gap-3 border-b px-4 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer",
                  isCurrentHead && "border-l-2 border-l-primary bg-primary/5"
                )}
              >
                <Badge variant={variant} className="shrink-0 px-1.5 py-0 text-[10px]">
                  {label}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {title}
                </span>
                {isCurrentHead && (
                  <Badge variant="secondary" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
                    <GitBranch size={10} />
                    <span className="max-w-24 truncate">{currentBranch || "HEAD"}</span>
                  </Badge>
                )}
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{shortHash}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(entry.date), "MMM d")}
                </span>
              </div>
            </ContextMenuTrigger>
            <GitCommitContextMenu workspaceId={workspaceId} entry={entry} onRefreshAll={onRefreshAll} onOpenPrompt={onOpenPrompt} />
          </ContextMenu>
        );
      })}
    </div>
  );
}
