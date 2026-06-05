"use client";

import { useState } from "react";
import { InfoIcon, FolderTreeIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ChatRightPanelProps {
  agentId?: string;
}

export function ChatRightPanel({ agentId }: ChatRightPanelProps) {
  const [tab, setTab] = useState("info");

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col rounded-xl border border-border/40 bg-background shadow-sm">
      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
        <TabsList className="mx-2 mt-2 w-auto self-center">
          <TabsTrigger value="info">
            <InfoIcon className="size-4" />
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <FolderTreeIcon className="size-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="flex-1 overflow-auto p-3">
          {agentId ? (
            <div className="text-sm text-muted-foreground">
              基本信息: {agentId}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              未选择 Agent
            </div>
          )}
        </TabsContent>

        <TabsContent value="workspace" className="flex-1 overflow-auto p-3">
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            工作区（占位）
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
