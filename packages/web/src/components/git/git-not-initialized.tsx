"use client";

import { useState, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { useGitStore } from "@/stores/git";

interface GitNotInitializedProps {
  workspaceId: string;
  onInitialized: () => void;
}

export function GitNotInitialized({ workspaceId, onInitialized }: GitNotInitializedProps) {
  const initRepo = useGitStore((s) => s.initRepo);
  const [initializing, setInitializing] = useState(false);

  const handleInit = useCallback(async () => {
    setInitializing(true);
    await initRepo(workspaceId);
    setInitializing(false);
    onInitialized();
  }, [workspaceId, initRepo, onInitialized]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
      <GitBranch size={32} className="text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground text-center">
        Not a Git repository
      </p>
      <button
        onClick={handleInit}
        disabled={initializing}
        className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {initializing ? "Initializing..." : "Initialize Git Repository"}
      </button>
    </div>
  );
}
