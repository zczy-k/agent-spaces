"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderTreeIcon, InfoIcon } from "lucide-react";
import type { FileNode } from "@agent-spaces/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTree, FileTreeNodes } from "@/components/editor/file-tree";
import { sdk } from "@/lib/sdk";
import { useChatStore } from "@/stores/chat";

interface ChatRightPanelProps {
  agentId?: string;
}

export function ChatRightPanel({ agentId }: ChatRightPanelProps) {
  const [tab, setTab] = useState("info");
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const agent = useChatStore((s) => s.agents.find((item) => item.id === agentId));
  const boundDir = agent?.workingDir ?? "";
  const workspaceTreeId = agentId ? `chat:${agentId}` : undefined;

  useEffect(() => {
    if (!agentId || tab !== "workspace") return;

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
  }, [agentId, tab]);

  const infoRows = useMemo(() => ([
    ["ID", agent?.id ?? ""],
    ["Name", agent?.name ?? ""],
    ["Model", agent?.model ?? ""],
    ["Working Dir", boundDir],
  ]), [agent, boundDir]);

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col rounded-xl border border-border/40 bg-background shadow-sm">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mt-2 w-full">
          <TabsTrigger value="info">
            <InfoIcon className="size-4" />
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <FolderTreeIcon className="size-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="flex-1 overflow-auto p-3">
          {agent ? (
            <div className="space-y-2 text-xs">
              {infoRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[72px_1fr] gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="min-w-0 truncate" title={value}>{value || "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              未选择 Agent
            </div>
          )}
        </TabsContent>

        <TabsContent value="workspace" className="min-h-0 flex-1 overflow-hidden">
          {!agentId ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              未选择 Agent
            </div>
          ) : loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : error ? (
            <div className="p-3 text-xs text-destructive">{error}</div>
          ) : tree.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              工作区为空
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
