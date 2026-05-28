"use client";

import type { GitLogEntry } from "@agent-spaces/shared";
import type { Commit } from "@/components/commit-graph";
import { CommitGraph } from "@/components/commit-graph";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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

function toCommits(log: GitLogEntry[]): Commit[] {
  return log.map((entry) => {
    const rawRefs = entry.refs ?? []
    const tag = rawRefs.find(r => r.startsWith('tag: '))?.replace('tag: ', '')
    const refs = rawRefs.filter(r => !r.startsWith('tag: '))
    return {
      hash: entry.hash,
      message: entry.message.split("\n")[0],
      author: { name: entry.author },
      date: entry.date,
      parents: entry.parents ?? [],
      refs,
      tag,
    }
  })
}

export function GitCommitLogList({ workspaceId, log, currentHeadHash, onSelectEntry, onRefreshAll, onOpenPrompt }: Props) {
  const commits = toCommits(log);

  if (commits.length === 0) return null;

  return (
    <CommitGraph
      commits={commits}
      currentHeadHash={currentHeadHash}
      className="border-0 rounded-none shadow-none"
      onCommitClick={(commit: Commit) => {
        const entry = log.find((e) => e.hash === commit.hash);
        if (entry) onSelectEntry(entry);
      }}
      renderCommitWrapper={(commit: Commit, children: React.ReactNode) => (
        <ContextMenu key={commit.hash}>
          <ContextMenuTrigger>{children}</ContextMenuTrigger>
          <GitCommitContextMenu
            workspaceId={workspaceId}
            entry={log.find((e) => e.hash === commit.hash)!}
            onRefreshAll={onRefreshAll}
            onOpenPrompt={onOpenPrompt}
          />
        </ContextMenu>
      )}
    />
  );
}
