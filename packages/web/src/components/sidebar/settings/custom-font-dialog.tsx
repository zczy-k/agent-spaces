"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileUpload, type FileUploadFile } from "@/components/ui/file-upload";
import { Loader2, Globe, Upload } from "lucide-react";
import { sdk } from "@/lib/sdk";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface CustomFontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFontAdded: (url: string, name: string) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CustomFontDialog({ open, onOpenChange, onFontAdded }: CustomFontDialogProps) {
  const t = useTranslations("settings");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [uploadFiles, setUploadFiles] = useState<FileUploadFile[]>([]);

  const reset = useCallback(() => {
    setUrl("");
    setUploadFiles([]);
    setLoading(false);
  }, []);

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setLoading(true);
    try {
      const file = uploadFiles[0].file;
      const content = await fileToBase64(file);
      const data = await sdk.http.post<{ url: string; name: string }>("/api/fonts/upload", { name: file.name, content });
      toast.success(t("fontAdded"));
      onFontAdded(data.url, data.name);
      handleClose(false);
    } catch {
      toast.error(t("fontAddFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleUrlConfirm = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      // Validate URL is reachable by creating a @font-face test
      const fontUrl = url.trim();
      const name = fontUrl.split("/").pop() || "custom-font";
      toast.success(t("fontAdded"));
      onFontAdded(fontUrl, name);
      handleClose(false);
    } catch {
      toast.error(t("fontAddFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("addCustomFont")}</DialogTitle>
          <DialogDescription>{t("addCustomFontDesc")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="upload" className="w-full flex flex-col gap-3">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="upload" className="gap-1 text-xs">
              <Upload className="size-3" />
              {t("fontUpload")}
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1 text-xs">
              <Globe className="size-3" />
              {t("fontOnlineUrl")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="space-y-3 pt-2">
            <FileUpload
              value={uploadFiles}
              onChange={setUploadFiles}
              accept={{ "font/*": [".ttf", ".otf", ".woff", ".woff2"] }}
              maxFiles={1}
              placeholder={t("fontUploadPlaceholder")}
            />
            <Button className="w-full" onClick={handleUpload} disabled={uploadFiles.length === 0 || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("fontUpload")}
            </Button>
          </TabsContent>
          <TabsContent value="url" className="space-y-3 pt-2">
            <Input
              placeholder="https://fonts.gstatic.com/s/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlConfirm()}
            />
            <p className="text-xs text-muted-foreground">{t("fontUrlHint")}</p>
            <Button className="w-full" onClick={handleUrlConfirm} disabled={!url.trim() || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("fontOnlineUrl")}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
