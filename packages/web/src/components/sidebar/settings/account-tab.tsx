"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { UserIcon } from "@/components/common/user-icon";
import { setCachedUserAvatarUrl } from "@/hooks/use-user-avatar";
import { AvatarPicker } from "./avatar-picker";

export function AccountTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.avatarUrl) setUserAvatarUrl(data.avatarUrl);
      })
      .catch(() => {});
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageSrc(URL.createObjectURL(file));
    setPickerOpen(true);
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
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </label>
            {userAvatarUrl && (
              <button type="button" className="text-xs text-destructive hover:underline cursor-pointer" onClick={handleRemove}>
                {tc("remove")}
              </button>
            )}
          </div>
        </div>
      </div>
      {imageSrc && (
        <AvatarPicker
          src={imageSrc}
          open={pickerOpen}
          onOpenChange={(v) => { if (!v) { setPickerOpen(false); setImageSrc(null); } }}
          onUploaded={(url) => setUserAvatarUrl(url)}
        />
      )}
    </div>
  );
}
