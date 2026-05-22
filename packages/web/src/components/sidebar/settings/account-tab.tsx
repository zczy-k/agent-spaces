"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { UserIcon } from "@/components/common/user-icon";
import { setCachedUserAvatarUrl } from "@/hooks/use-user-avatar";

export function AccountTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.avatarUrl) setUserAvatarUrl(data.avatarUrl);
      })
      .catch(() => {});
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/upload/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        const data = await res.json();
        if (data.url) {
          const url = `${data.url}?t=${Date.now()}`;
          setUserAvatarUrl(url);
          setCachedUserAvatarUrl(url);
          fetch("/api/user/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarUrl: data.url }),
          }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemove = () => {
    setUserAvatarUrl(null);
    setCachedUserAvatarUrl(null);
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: null }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("userAvatar")}
        </label>
        <div className="flex items-center gap-3">
          <UserIcon size="lg" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-primary cursor-pointer hover:underline">
              {tc("upload")}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            {userAvatarUrl && (
              <button type="button" className="text-xs text-destructive hover:underline cursor-pointer" onClick={handleRemove}>
                {tc("remove")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
