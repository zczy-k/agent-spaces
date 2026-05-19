"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import { authHeaders } from "@/lib/auth";
import { tauriNavigate } from "@/lib/navigate";
import type { Workspace } from "@agent-spaces/shared";

export default function Page() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/workspaces", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Workspace[]) => {
        setWorkspaces(list);
        if (
          localStorage.getItem("autoActivateWorkspace") === "true" &&
          !sessionStorage.getItem("autoActivateSkipped")
        ) {
          const lastId = localStorage.getItem("lastWorkspaceId");
          if (lastId && list.some((ws) => ws.id === lastId)) {
            sessionStorage.setItem("autoActivateSkipped", "1");
            tauriNavigate(router, `/workspace/${lastId}`, true);
          }
        }
      });
  }, [router]);

  return <HomePage initialWorkspaces={workspaces} />;
}
