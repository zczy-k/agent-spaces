"use client";

import { useEffect, useState } from "react";
import { useCodeFavoritesStore, type PendingFavorite } from "@/stores/code-favorites";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddFavoriteDialog() {
  const { pendingFavorite, setPendingFavorite, addFavorite } = useCodeFavoritesStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (pendingFavorite) setTitle("");
  }, [pendingFavorite]);

  if (!pendingFavorite) return null;

  const handleSubmit = () => {
    addFavorite({
      ...pendingFavorite,
      label: title.trim() || pendingFavorite.label,
    });
    setPendingFavorite(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setPendingFavorite(null);
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加代码收藏</DialogTitle>
        </DialogHeader>
        <FavoritePreview fav={pendingFavorite} />
        <div className="space-y-2">
          <Input
            placeholder="标题（可选）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
          />
          {pendingFavorite.snippet && (
            <pre className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
              {pendingFavorite.snippet}
            </pre>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingFavorite(null)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            收藏
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FavoritePreview({ fav }: { fav: PendingFavorite }) {
  const fileName = fav.path.split("/").pop() || fav.path;
  const lineLabel = fav.endLine > fav.line ? `${fav.line}-${fav.endLine}` : `${fav.line}`;
  return (
    <div className="text-sm text-muted-foreground space-y-0.5">
      <div className="font-medium text-foreground">{fileName}</div>
      <div>
        {fav.path}:{lineLabel}
      </div>
    </div>
  );
}
