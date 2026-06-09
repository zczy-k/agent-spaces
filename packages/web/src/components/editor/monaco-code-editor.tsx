"use client";

import dynamic from "next/dynamic";
import type { EditorProps } from "@monaco-editor/react";
import "@/lib/monaco-loader";

function MonacoCodeEditorLoading() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Loading editor...
    </div>
  );
}

const MonacoCodeEditor = dynamic<EditorProps>(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false, loading: () => <MonacoCodeEditorLoading /> },
);

export type { EditorProps as MonacoCodeEditorProps };
export { MonacoCodeEditor };
