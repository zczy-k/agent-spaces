"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid(theme: string) {
  if (mermaidInitialized) return;
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "loose",
  });
}

interface MermaidPreviewProps {
  chart: string;
  theme?: string;
}

export function MermaidPreview({ chart, theme = "light" }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  const renderChart = useCallback(async () => {
    if (!chart.trim()) {
      setSvg("");
      setError(null);
      return;
    }

    initMermaid(theme);

    try {
      const id = `mermaid-${Date.now()}`;
      const { svg: rendered } = await mermaid.render(id, chart);
      setSvg(rendered);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^Parse error.*?:/, "").trim());
      // mermaid.render creates a broken element on error, clean it up
      const errEl = document.getElementById("d" + "mermaid-" + Date.now());
      if (errEl) errEl.remove();
    }
  }, [chart, theme]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  if (error) {
    return (
      <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-md">
        <p className="font-medium mb-1">Mermaid syntax error</p>
        <pre className="whitespace-pre-wrap text-xs">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">Rendering...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
