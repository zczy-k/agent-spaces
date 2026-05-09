"use client";

import "@/lib/api-polyfill";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated, getToken, removeToken } from "@/lib/auth";
import { tauriNavigate } from "@/lib/navigate";
import { isLoginPath } from "@/lib/routes";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const isLogin = isLoginPath(pathname);

  useEffect(() => {
    if (isLogin) {
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
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          removeToken();
          tauriNavigate(router, "/login", true);
          return null;
        }
        return res.ok ? res.json() : { authenticated: true };
      })
      .then((data) => {
        if (data === null) return;
        if (data.authenticated) {
          setChecked(true);
        } else {
          removeToken();
          tauriNavigate(router, "/login", true);
        }
      })
      .catch(() => setChecked(true));
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!checked) return null;

  return <>{children}</>;
}
