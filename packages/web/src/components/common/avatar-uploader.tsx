"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AgentIcon } from "@/components/common/agent-icon";
import { AvatarPicker } from "@/components/sidebar/settings/avatar-picker";
import { X } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export interface AvatarUploaderProps {
  name: string;
  avatarUrl: string;
  icon?: string;
  apiBase?: string;
  onAvatarUrlChange: (url: string) => void;
  onIconChange: (icon: string) => void;
  className?: string;
}

export function AvatarUploader({
  name,
  avatarUrl,
  icon,
  apiBase,
  onAvatarUrlChange,
  onIconChange,
  className,
}: AvatarUploaderProps) {
  const t = useTranslations("agent");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiPickerOpen]);

  return (
    <div className={`relative flex flex-col items-center gap-1.5 ${className ?? ""}`}>
      {avatarUrl ? (
        <div className="relative">
          <AgentIcon
            name={name}
            avatarUrl={avatarUrl}
            icon={icon}
            apiBase={apiBase}
            className="size-16 rounded-xl border border-input"
          />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 cursor-pointer"
            onClick={() => onAvatarUrlChange("")}
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="relative size-16 rounded-xl border border-input bg-muted flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setEmojiPickerOpen((v) => !v)}
        >
          {icon ? (
            <span className="text-2xl">{icon}</span>
          ) : (
            <span className="text-lg text-muted-foreground">{name?.charAt(0).toUpperCase() || "?"}</span>
          )}
          {emojiPickerOpen && (
            <div ref={emojiRef} className="absolute top-full left-0 z-50 mt-1" onClick={(e) => e.stopPropagation()}>
              <EmojiPicker
                open={emojiPickerOpen}
                onEmojiClick={(emoji) => {
                  onIconChange(emoji.emoji);
                  setEmojiPickerOpen(false);
                }}
                width={280}
                height={350}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
              />
            </div>
          )}
        </button>
      )}
      <label className="text-[10px] text-primary cursor-pointer hover:underline">
        {t("detail.uploadAvatar")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              setAvatarSrc(reader.result as string);
              setAvatarPickerOpen(true);
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </label>
      <AvatarPicker
        src={avatarSrc}
        open={avatarPickerOpen}
        onOpenChange={setAvatarPickerOpen}
        onUploaded={(url) => onAvatarUrlChange(url)}
        skipUserSettings
      />
    </div>
  );
}
