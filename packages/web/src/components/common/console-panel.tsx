"use client";

import { useEffect, useRef, useState } from "react";
import { FloatingPanel } from "@/components/common/floating-panel";

interface ErrorEntry {
  id: number;
  time: number;
  args: unknown[];
}

export function ConsolePanel() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const idRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const originalError = useRef(console.error);

  useEffect(() => {
    const orig = originalError.current;
    console.error = (...args: unknown[]) => {
      orig.apply(console, args);
      idRef.current += 1;
      setErrors((prev) => [
        ...prev.slice(-199),
        { id: idRef.current, time: Date.now(), args },
      ]);
    };
    return () => {
      console.error = orig;
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [errors]);

  const formatArg = (arg: unknown): string => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "string") return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <FloatingPanel
      id="console-panel"
      title="Console"
      defaultX={window.innerWidth - 440}
      defaultY={40}
      defaultWidth={400}
      defaultHeight={300}
      initialMinimized
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">
            Errors: {errors.length}
          </span>
          <button
            className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            onClick={() => setErrors([])}
          >
            Clear
          </button>
        </div>
        <div
          ref={listRef}
          className="flex-1 overflow-auto space-y-1 text-xs font-mono"
        >
          {errors.length === 0 && (
            <div className="text-gray-400 text-center py-4">
              No console errors captured
            </div>
          )}
          {errors.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 whitespace-pre-wrap break-all"
            >
              <span className="text-red-400 dark:text-red-500">
                [{formatTime(entry.time)}]
              </span>{" "}
              {entry.args.map(formatArg).join(" ")}
            </div>
          ))}
        </div>
      </div>
    </FloatingPanel>
  );
}
