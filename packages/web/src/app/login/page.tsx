"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!secret.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (data.noSecret) {
        router.push("/");
        return;
      }

      setToken(data.token);
      router.push("/");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Agent Spaces</h1>
          <p className="text-sm text-muted-foreground">Enter your secret key to continue</p>
        </div>
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="Secret key"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleLogin} disabled={!secret.trim() || loading}>
            {loading ? "Verifying..." : "Login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
