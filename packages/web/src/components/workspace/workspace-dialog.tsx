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
import type { Workspace } from "@agent-spaces/shared";

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: Workspace | null;
  onSubmit: (data: { name: string; boundDirs: string[] }) => Promise<void>;
}

export function WorkspaceDialog({ open, onOpenChange, workspace, onSubmit }: WorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [dir, setDir] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = !!workspace;

  useEffect(() => {
    if (open) {
      setName(workspace?.name ?? "");
      setDir(workspace?.boundDirs[0] ?? "");
    }
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

  return (
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
          <input
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="/path/to/project"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
          />
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
  );
}
