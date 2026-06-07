"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FileNode } from "@agent-spaces/shared";
import { FileTree, FileTreeNodes } from "@/components/editor/file-tree";
import { sdk } from "@/lib/sdk";
import { useChatStore } from "@/stores/chat";

interface ChatRightPanelProps {
  agentId?: string;
}

export function ChatRightPanel({ agentId }: ChatRightPanelProps) {
  const t = useTranslations('chat.rightPanel');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const agent = useChatStore((s) => s.agents.find((item) => item.id === agentId));
  const boundDir = agent?.workingDir ?? "";
  const workspaceTreeId = agentId ? `chat:${agentId}` : undefined;

  useEffect(() => {
    if (!agentId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    sdk.chat.workspaceTree(agentId)
      .then((nodes) => {
        if (cancelled) return;
        setTree(nodes);
        setExpanded(new Set(nodes.filter((node) => node.type === "directory").map((node) => node.path)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load workspace");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col rounded-xl border border-border/40 bg-background shadow-sm">
      {!agentId ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('noAgent')}
        </div>
      ) : loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('loading')}
        </div>
      ) : error ? (
        <div className="p-3 text-xs text-destructive">{error}</div>
      ) : tree.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('emptyWorkspace')}
        </div>
      ) : (
        <FileTree
          expanded={expanded}
          onExpandedChange={setExpanded}
          workspaceId={workspaceTreeId}
          boundDir={boundDir}
          className="h-full"
        >
          <FileTreeNodes nodes={tree} />
        </FileTree>
      )}
    </div>
  );
}
