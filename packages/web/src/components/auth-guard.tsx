"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    fetch("/api/auth/check", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
        } else {
          setChecked(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (!checked) return null;

  return <>{children}</>;
}
