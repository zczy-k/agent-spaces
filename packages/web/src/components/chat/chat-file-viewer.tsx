"use client";

import { useEffect, useRef } from "react";
import "@/lib/monaco-loader";
import { useTheme } from "@/components/layout/theme-provider";
import { getOrCreateModel } from "@/lib/monaco-models";

interface ChatFileViewerProps {
  path: string;
  content: string;
}

export function ChatFileViewer({ path, content }: ChatFileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<{ dispose: () => void } | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    import("monaco-editor").then((monaco) => {
      if (disposed || !containerRef.current) return;

      const model = getOrCreateModel("chat", path, content);

      const editor = monaco.editor.create(containerRef.current, {
        model,
        readOnly: true,
        theme: theme === "dark" ? "vs-dark" : "vs",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: "on",
        renderLineHighlight: "all",
        automaticLayout: true,
      });

      editorRef.current = editor;
    });

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    import("monaco-editor").then((monaco) => {
      monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");
    });
  }, [theme]);

  return <div ref={containerRef} className="h-full w-full" />;
}
