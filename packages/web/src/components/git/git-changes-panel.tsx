"use client";

import { useEffect, useCallback } from "react";
import { useGitStore } from "@/stores/git";
import { DiffViewer } from "./diff-viewer";

interface GitPanelProps {
  workspaceId: string;
}

const statusColors: Record<string, string> = {
  modified: "text-yellow-600",
  added: "text-green-600",
  deleted: "text-red-600",
  renamed: "text-blue-600",
  untracked: "text-gray-500",
};

const statusLabels: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

export function GitChangesPanel({ workspaceId }: GitPanelProps) {
  const { status, diffs, selectedFile, loading, loadStatus, loadDiffs, selectFile } = useGitStore();

  const refresh = useCallback(() => {
    loadStatus(workspaceId);
    loadDiffs(workspaceId);
  }, [workspaceId, loadStatus, loadDiffs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFileClick = useCallback(
    (path: string) => {
      selectFile(path === selectedFile ? null : path);
    },
    [selectedFile, selectFile],
  );

  const selectedDiff = diffs.find((d) => d.path === selectedFile);

  return (
    <div className="flex h-full">
      {/* File list */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="flex items-center justify-between px-2 py-1.5 border-b">
          <span className="text-xs font-medium">
            {status ? (
              <>
                <span className="text-muted-foreground">{status.branch}</span>
                {status.files.length > 0 && (
                  <span className="ml-1 text-muted-foreground">({status.files.length})</span>
                )}
              </>
            ) : (
              "Git"
            )}
          </span>
          <button
            onClick={refresh}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && !status && (
            <div className="p-2 text-xs text-muted-foreground">Loading...</div>
          )}
          {status?.files.map((f) => (
            <button
              key={f.path}
              onClick={() => handleFileClick(f.path)}
              className={`w-full text-left px-2 py-1 text-xs font-mono flex items-center gap-1.5 hover:bg-accent ${
                selectedFile === f.path ? "bg-accent" : ""
              }`}
            >
              <span className={`w-4 text-center font-bold ${statusColors[f.status]}`}>
                {statusLabels[f.status]}
              </span>
              <span className="truncate">{f.path}</span>
            </button>
          ))}
          {status?.clean && (
            <div className="p-2 text-xs text-muted-foreground">No changes</div>
          )}
        </div>
      </div>

      {/* Diff area */}
      <div className="flex-1">
        {selectedDiff ? (
          <DiffViewer
            oldContent={selectedDiff.oldContent}
            newContent={selectedDiff.newContent}
            path={selectedDiff.path}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            {status?.files.length
              ? "Select a file to view diff"
              : "No changes to show"}
          </div>
        )}
      </div>
    </div>
  );
}
