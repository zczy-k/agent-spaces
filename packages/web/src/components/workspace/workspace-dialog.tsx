"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AgentConfig, Workspace } from "@agent-spaces/shared";
import { AddMemberDialog, type AddMemberCandidate } from "@/components/chat/add-member-dialog";
import { Bot, Plus, X } from "lucide-react";
import { FolderPicker } from "@/components/ui/folder-picker";

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: Workspace | null;
  onSubmit: (data: { name: string; boundDirs: string[] }) => Promise<void>;
  onAgentsChanged?: () => void;
}

export function WorkspaceDialog({ open, onOpenChange, workspace, onSubmit, onAgentsChanged }: WorkspaceDialogProps) {
  return (
    <WorkspaceDialogContent
      key={open ? workspace?.id ?? "new" : "closed"}
      open={open}
      onOpenChange={onOpenChange}
      workspace={workspace}
      onSubmit={onSubmit}
      onAgentsChanged={onAgentsChanged}
    />
  );
}

function WorkspaceDialogContent({ open, onOpenChange, workspace, onSubmit, onAgentsChanged }: WorkspaceDialogProps) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [dir, setDir] = useState(workspace?.boundDirs[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [agentCandidates, setAgentCandidates] = useState<AddMemberCandidate[]>([]);
  const [workspaceAgents, setWorkspaceAgents] = useState<AgentConfig[]>(workspace?.agents ?? []);
  const [agentLoading, setAgentLoading] = useState(false);
  const isEdit = !!workspace;

  useEffect(() => {
    if (!open || !workspace) return;
    const controller = new AbortController();
    fetch(`/api/workspaces/${workspace.id}/agent-templates`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<Array<{ id: string; name?: string; role: string; description?: string }>>;
      })
      .then((agents) => {
        setAgentCandidates(agents.map((agent) => ({
          id: agent.id,
          label: agent.name || agent.role,
          description: agent.description || agent.role,
        })));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setAgentCandidates([]);
      });
    return () => controller.abort();
  }, [open, workspace]);

  const handleSubmit = async () => {
    if (!name || !dir) return;
    setLoading(true);
    try {
      await onSubmit({ name, boundDirs: [dir] });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgents = async (agentIds: string[]) => {
    if (!workspace || agentIds.length === 0) return;
    setAgentLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/agents/from-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      const added = await res.json() as AgentConfig[];
      setWorkspaceAgents((prev) => [...prev, ...added]);
      setAgentCandidates((prev) => prev.filter((candidate) => !agentIds.includes(candidate.id)));
      onAgentsChanged?.();
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Workspace" : "New Workspace"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update workspace settings." : "Create a new workspace bound to a local directory."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <input
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
          />
          <FolderPicker
            value={dir}
            onChange={setDir}
            placeholder="/path/to/project"
          />
          {isEdit && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="size-4 text-muted-foreground" />
                  Agents
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddAgentOpen(true)}
                  disabled={agentLoading || agentCandidates.length === 0}
                >
                  <Plus className="size-3.5" />
                  Add Agent
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workspaceAgents.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No agents in this workspace</span>
                ) : (
                  workspaceAgents.map((agent) => (
                    <span key={agent.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                      {agent.name || agent.role}
                      <X className="size-3 text-muted-foreground" />
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !dir || loading}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {workspace && (
      <AddMemberDialog
        open={addAgentOpen}
        onOpenChange={setAddAgentOpen}
        candidates={agentCandidates}
        onAdd={handleAddAgents}
      />
    )}
    </>
  );
}
