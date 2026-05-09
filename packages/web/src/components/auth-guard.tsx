"use client";

import "@/lib/api-polyfill";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated, getToken } from "@/lib/auth";
import { tauriNavigate } from "@/lib/navigate";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    if (!isAuthenticated()) {
      tauriNavigate(router, "/login", true);
      return;
    }

    const token = getToken();
    fetch("/api/auth/check", {
      headers: token !== null ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setChecked(true);
        } else {
          tauriNavigate(router, "/login", true);
        }
      })
      .catch(() => tauriNavigate(router, "/login", true));
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (!checked) return null;

  return <>{children}</>;
}
