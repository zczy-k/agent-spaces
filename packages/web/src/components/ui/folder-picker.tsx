"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Folder, FolderOpen, ChevronRight, ArrowUp, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderBrowseResult {
  path: string;
  parent: string | null;
  separator: string;
  home: string;
  directories: Array<{ name: string; path: string }>;
}

interface FolderPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function FolderPicker({ value, onChange, className, placeholder = "/path/to/project" }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(value || "");
  const [directories, setDirectories] = useState<FolderBrowseResult["directories"]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const browse = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/folder/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to browse");
      const data: FolderBrowseResult = await res.json();
      setCurrentPath(data.path);
      setDirectories(data.directories);
      setParentPath(data.parent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      browse(value || "");
    }
  }, [open, value, browse]);

  const navigateTo = (path: string) => {
    browse(path);
  };

  const goUp = () => {
    if (parentPath) browse(parentPath);
  };

  const selectCurrent = () => {
    onChange(currentPath);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      browse(value);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          ref={inputRef}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <FolderOpen className="size-4" />
          Browse
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col rounded-xl border border-border bg-popover shadow-lg" style={{ height: 360 }}>
          {/* Header: path breadcrumb */}
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => navigateTo("")}
              className="flex size-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
              title="Home"
            >
              <Home className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={goUp}
              className="flex size-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
              title="Go up"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <div className="flex-1 truncate rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground font-mono">
              {currentPath}
            </div>
            <button
              type="button"
              onClick={selectCurrent}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Select
            </button>
          </div>

          {/* Directory list */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="px-3 py-8 text-center text-xs text-destructive">{error}</div>
            ) : directories.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">No subdirectories</div>
            ) : (
              directories.map((dir) => (
                <button
                  key={dir.path}
                  type="button"
                  onClick={() => navigateTo(dir.path)}
                  onDoubleClick={() => {
                    onChange(dir.path);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  <Folder className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{dir.name}</span>
                  <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
