"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/sidebar/app-sidebar";
import { WorkspaceTabs } from "@/components/layout/workspace-tabs";
import { DevInspector } from "@/components/dev-inspector";
import { WorkspaceDialog } from "@/components/workspace/workspace-dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import { isLoginPath } from "@/lib/routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showTabs, setShowTabs] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("showWorkspaceTabs");
    return saved === null ? true : saved !== "false";
  });

  useEffect(() => {
    const handler = (e: Event) => setShowTabs((e as CustomEvent).detail);
    window.addEventListener("workspace-tabs-visibility", handler);
    return () => window.removeEventListener("workspace-tabs-visibility", handler);
  }, []);

  if (isLoginPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <DevInspector />
      <SidebarProvider className="h-[var(--app-content-height)] min-h-0 bg-[#f2f3f5] dark:bg-[#0f1117]">
        <DashboardSidebar />
        <SidebarInset className="!bg-transparent">
          {showTabs && <WorkspaceTabs />}
          {children}
        </SidebarInset>
      </SidebarProvider>
      <GlobalWorkspaceDialog />
    </>
  );
}

function GlobalWorkspaceDialog() {
  const dialogOpen = useWorkspaceStore((s) => s.dialogOpen);
  const editingWorkspace = useWorkspaceStore((s) => s.editingWorkspace);
  const closeWorkspaceDialog = useWorkspaceStore((s) => s.closeWorkspaceDialog);
  const upsertWorkspace = useWorkspaceStore((s) => s.upsertWorkspace);

  const handleSubmit = async (data: { name: string; boundDirs: string[] }) => {
    if (editingWorkspace) {
      const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const ws = await res.json();
      upsertWorkspace(ws);
    } else {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const ws = await res.json();
      upsertWorkspace(ws);
    }
  };

  return (
    <WorkspaceDialog
      open={dialogOpen}
      onOpenChange={(open) => { if (!open) closeWorkspaceDialog(); }}
      workspace={editingWorkspace}
      onSubmit={handleSubmit}
    />
  );
}
