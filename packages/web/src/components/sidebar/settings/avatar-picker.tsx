"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ImageCropper } from "@/components/ui/image-cropper"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { setCachedUserAvatarUrl } from "@/hooks/use-user-avatar"

const ASPECTS = [
  { label: "aspectCircle", value: 1 },
  { label: "aspect3x4", value: 3 / 4 },
  { label: "aspect16x9", value: 16 / 9 },
] as const

interface AvatarPickerProps {
  src: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (url: string) => void
  /** 为 true 时跳过写入用户设置（agent 头像等场景） */
  skipUserSettings?: boolean
}

export function AvatarPicker({ src, open, onOpenChange, onUploaded, skipUserSettings }: AvatarPickerProps) {
  const t = useTranslations("settings")
  const [aspect, setAspect] = useState<number>(1)

  async function handleCropComplete(dataUrl: string) {
    try {
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      })
      const data = await res.json()
      if (data.url) {
        const url = `${data.url}?t=${Date.now()}`
        if (!skipUserSettings) {
          setCachedUserAvatarUrl(url)
          fetch("/api/user/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarUrl: data.url }),
          }).catch(() => {})
        }
        onUploaded(url)
      }
    } catch {
      /* ignore */
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false) }}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("cropAvatar")}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                aspect === a.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setAspect(a.value)}
            >
              {t(a.label)}
            </button>
          ))}
        </div>
        <ImageCropper
          src={src}
          aspect={aspect}
          onCropComplete={handleCropComplete}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
