"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DialogSetterMap } from "./use-sidebar-dialogs";

const routeMap: Record<string, string> = {
  agents: "/settings/agents",
  skills: "/settings/skills",
  prompts: "/settings/prompts",
  "output-styles": "/settings/output-styles",
  mcps: "/settings/mcps",
  models: "/settings/models",
  providers: "/settings/providers",
  hooks: "/settings",
  commands: "/settings",
  settings: "/settings",
};

export function useSidebarEvents({
  toggleSidebarWithAnimation,
  isMobile,
  router,
  setterMap,
  matchesEvent,
  setUserToggled,
}: {
  toggleSidebarWithAnimation: () => void;
  isMobile: boolean;
  router: ReturnType<typeof useRouter>;
  setterMap: DialogSetterMap;
  matchesEvent: (id: string, e: KeyboardEvent) => boolean;
  setUserToggled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const setterMapRef = useRef(setterMap);

  useEffect(() => {
    setterMapRef.current = setterMap;
  });

  useEffect(() => {
    const toggleHandler = () => toggleSidebarWithAnimation();
    const dialogHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (isMobile && routeMap[detail]) {
        router.push(routeMap[detail]);
        return;
      }
      const setter = setterMapRef.current[detail];
      if (setter) setter(true);
    };
    window.addEventListener("toggle-sidebar", toggleHandler);
    window.addEventListener("open-dialog", dialogHandler);
    return () => {
      window.removeEventListener("toggle-sidebar", toggleHandler);
      window.removeEventListener("open-dialog", dialogHandler);
    };
  }, [toggleSidebarWithAnimation, isMobile, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesEvent("toggleSidebar", e)) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebarWithAnimation();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        setUserToggled(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleSidebarWithAnimation, matchesEvent, setUserToggled]);
}
