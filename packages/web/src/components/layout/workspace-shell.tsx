"use client";

import { useCallback, useEffect } from "react";
import { Layout, Model, TabNode, IJsonModel } from "flexlayout-react";
import "flexlayout-react/style/light.css";
import { EditorPanel } from "@/components/editor/editor-panel";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { ChannelList } from "@/components/chat/channel-list";
import { ChatPanel } from "@/components/chat/chat-panel";
import { IssueList } from "@/components/issue/issue-list";
import { IssueDetail } from "@/components/issue/issue-detail";
import { getWS } from "@/lib/ws";
import { useIssueStore } from "@/stores/issue";
import { useTaskStore } from "@/stores/task";
import type { Issue, Task } from "@agent-spaces/shared";

const defaultJson: IJsonModel = {
  global: {
    tabSetEnableTabStrip: true,
    borderEnableDrop: true,
  },
  borders: [
    {
      type: "border",
      location: "bottom",
      children: [
        { type: "tab", name: "Terminal", component: "terminal" },
        { type: "tab", name: "Git", component: "git" },
      ],
    },
  ],
  layout: {
    type: "row",
    children: [
      {
        type: "tabset",
        weight: 0.25,
        children: [
          { type: "tab", name: "Channels", component: "channel-list" },
          { type: "tab", name: "Issues", component: "issue-list" },
        ],
      },
      {
        type: "tabset",
        weight: 0.75,
        children: [
          { type: "tab", name: "Editor", component: "editor" },
          { type: "tab", name: "Chat", component: "chat" },
          { type: "tab", name: "Issue Detail", component: "issue-detail" },
        ],
      },
    ],
  },
};

interface WorkspaceShellProps {
  workspaceId: string;
}

export function WorkspaceShell({ workspaceId }: WorkspaceShellProps) {
  const issueStore = useIssueStore();
  const taskStore = useTaskStore();

  useEffect(() => {
    const ws = getWS(workspaceId);
    const unsubs = [
      ws.on('issue.created', (data) => issueStore.upsertIssue(data as Issue)),
      ws.on('issue.updated', (data) => issueStore.upsertIssue(data as Issue)),
      ws.on('issue.status_changed', () => {
        issueStore.loadIssues(workspaceId);
      }),
      ws.on('task.created', (data) => taskStore.upsertTask(data as Task)),
      ws.on('task.updated', (data) => taskStore.upsertTask(data as Task)),
      ws.on('task.status_changed', () => {
        const activeIssueId = useIssueStore.getState().activeIssueId;
        if (activeIssueId) {
          taskStore.loadTasks(workspaceId, activeIssueId);
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [workspaceId]);

  const factory = useCallback(
    (node: TabNode) => {
      const comp = node.getComponent();
      switch (comp) {
        case "channel-list":
          return <ChannelList workspaceId={workspaceId} />;
        case "issue-list":
          return <IssueList workspaceId={workspaceId} />;
        case "editor":
          return <EditorPanel workspaceId={workspaceId} />;
        case "chat":
          return <ChatPanel workspaceId={workspaceId} />;
        case "issue-detail":
          return <IssueDetail workspaceId={workspaceId} />;
        case "terminal":
          return <TerminalPanel workspaceId={workspaceId} />;
        case "git":
          return <Placeholder name="Git" />;
        default:
          return <Placeholder name={node.getName()} />;
      }
    },
    [workspaceId],
  );

  const model = Model.fromJson(defaultJson);

  return (
    <div className="h-screen w-screen">
      <Layout model={model} factory={factory} />
    </div>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      {name} (coming soon)
    </div>
  );
}
