"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIframeTabs } from "@/stores/iframe-tabs";
import { useCommandPalette } from "@/stores/command-palette";
import { Globe, X, Home, Plus, Trash2, Bookmark } from "lucide-react";
import { FloatingBall } from "./floating-ball";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------- Link Interceptor ----------
export function IframeLinkInterceptor() {
  const add = useIframeTabs((s) => s.add);

  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href || anchor.target !== "_blank") return;

      try {
        const link = new URL(anchor.href, window.location.href);
        if (link.origin === window.location.origin) return;
      } catch {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      add(anchor.href, anchor.textContent || undefined);
    };

    const originalOpen = window.open;
    window.open = function (url?: string | URL, target?: string, features?: string): Window | null {
      if (url) {
        try {
          const resolved = typeof url === "string" ? new URL(url, window.location.href) : url;
          if (resolved.origin !== window.location.origin) {
            add(resolved.href);
            return null;
          }
        } catch {}
      }
      return originalOpen.call(this, url, target, features);
    };

    document.addEventListener("click", clickHandler, true);
    return () => {
      document.removeEventListener("click", clickHandler, true);
      window.open = originalOpen;
    };
  }, [add]);

  return null;
}

// ---------- Floating Ball ----------
const BALL_SIZE = 40;
const MENU_WIDTH = 260;

export function IframeFloatingBall() {
  const { tabs, activeId, setActive, remove, ballVisible, bookmarks, loadBookmarks, addBookmark, removeBookmark, add } = useIframeTabs();
  const register = useCommandPalette((s) => s.register);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const ballRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const count = tabs.length;

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    return register({
      id: "iframe-toggle-ball",
      label: ballVisible ? "隐藏 Iframe 悬浮球" : "显示 Iframe 悬浮球",
      group: "视图",
      icon: Globe,
      action: () => useIframeTabs.getState().toggleBall(),
    });
  }, [register, ballVisible]);

  const handleClick = useCallback(() => {
    if (ballRef.current) {
      const rect = ballRef.current.getBoundingClientRect();
      setMenuPos({
        x: Math.max(12, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)),
        y: rect.bottom + 6,
      });
    }
    setOpen((v) => !v);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (ballRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAddBookmark = async () => {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    const bookmark = await addBookmark(title.trim(), url.trim());
    setSaving(false);
    if (bookmark) {
      const tabId = add(bookmark.url, bookmark.title);
      setActive(tabId);
      setTitle("");
      setUrl("");
      setDialogOpen(false);
      setOpen(false);
    }
  };

  if (!ballVisible) return null;

  return (
    <>
      <FloatingBall
        ref={ballRef}
        lsKey="iframe-ball:pos"
        size={BALL_SIZE}
        onClick={handleClick}
        className="bg-gradient-to-br from-violet-500 to-violet-400 text-white shadow-lg hover:shadow-xl transition-shadow"
      >
        <Globe size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count}
          </span>
        )}
      </FloatingBall>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[99999] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
          style={{ left: menuPos.x, top: menuPos.y, width: MENU_WIDTH, maxHeight: "calc(100vh - 80px)" }}
        >
          <div className="p-1.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
            <TabItem
              icon={<Home size={14} />}
              label="主页面"
              active={activeId === null}
              onClick={() => {
                setActive(null);
                setOpen(false);
              }}
            />

            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                icon={<Globe size={14} />}
                label={tab.title}
                active={activeId === tab.id}
                onClick={() => {
                  setActive(tab.id);
                  setOpen(false);
                }}
                onClose={() => remove(tab.id)}
              />
            ))}

            {bookmarks.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                  <Bookmark size={10} />
                  书签
                </div>
                {bookmarks.map((bm) => (
                  <TabItem
                    key={bm.id}
                    icon={<Bookmark size={14} />}
                    label={bm.title}
                    active={false}
                    onClick={() => {
                      const tabId = add(bm.url, bm.title);
                      setActive(tabId);
                      setOpen(false);
                    }}
                    onDelete={() => removeBookmark(bm.id)}
                  />
                ))}
              </>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-zinc-800 p-1.5">
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            >
              <Plus size={14} />
              添加 Iframe
            </button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>添加 Iframe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="iframe-title">标题</Label>
              <Input
                id="iframe-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：Google"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iframe-url">URL</Label>
              <Input
                id="iframe-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddBookmark} disabled={!title.trim() || !url.trim() || saving}>
              {saving ? "添加中..." : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
  onClose,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-sm group ${
        active
          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
          : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
      }`}
    >
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded p-0.5 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded p-0.5 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// ---------- Iframe Overlay ----------
export function IframeOverlay() {
  const { tabs, activeId } = useIframeTabs();
  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  if (!activeTab) return null;

  return (
    <div className="fixed inset-0 z-[99990] bg-white dark:bg-zinc-900" style={{ paddingTop: 0 }}>
      <iframe
        src={activeTab.url}
        className="w-full h-full border-none"
        title={activeTab.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
