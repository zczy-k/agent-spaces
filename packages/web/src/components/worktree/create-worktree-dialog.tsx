"use client";

import { useState } from "react";
import { useWorktreeStore } from "@/stores/worktree";
import { useAgentStore } from "@/stores/agent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateWorktreeDialog({ open, onOpenChange, workspaceId }: CreateWorktreeDialogProps) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const create = useWorktreeStore((s) => s.create);
  const agents = useAgentStore((s) => s.agents);
  const t = useTranslations("worktree");

  const handleSubmit = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await create(workspaceId, {
        name,
        branch: branch || undefined,
        agentId: agentId || undefined,
      });
      setName("");
      setBranch("");
      setAgentId("");
      onOpenChange(false);
    } catch {
      // error handled by store
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialog.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t("dialog.name")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dialog.namePlaceholder")}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("dialog.branch")}</label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={t("dialog.branchPlaceholder")}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("dialog.agent")}</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || loading}>
            {loading ? t("dialog.creating") : t("panel.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
