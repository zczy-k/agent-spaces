import React, { useCallback, useState } from 'react';
import { domToJpeg, domToPng } from 'modern-screenshot';
import { useReactFlow } from '@xyflow/react';

export function useCanvasExport(
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>,
  workflowName: string,
) {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const [minimapVisible, setMinimapVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('agent-spaces:workflow-minimap-visible') !== 'false';
  });
  const [isExporting, setIsExporting] = useState(false);

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((current) => {
      const next = !current;
      try { localStorage.setItem('agent-spaces:workflow-minimap-visible', String(next)); } catch {}
      return next;
    });
  }, []);

  const exportCanvas = useCallback(async (format: 'png' | 'jpeg') => {
    const flowElement = reactFlowWrapper.current?.querySelector<HTMLElement>('.react-flow');
    if (!flowElement || isExporting) return;

    setIsExporting(true);
    const viewport = getViewport();
    try {
      fitView({ padding: 0.15, duration: 0 });
      await new Promise(resolve => window.setTimeout(resolve, 150));

      const name = (workflowName || 'workflow').replace(/[^\w一-龥-]+/g, '-');
      const dataUrl = format === 'jpeg'
        ? await domToJpeg(flowElement, { quality: 0.95, backgroundColor: '#ffffff', scale: 2 })
        : await domToPng(flowElement, { backgroundColor: null, scale: 2 });

      const link = document.createElement('a');
      link.download = `${name}-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[WorkflowCanvas] export failed', error);
    } finally {
      void setViewport(viewport);
      setIsExporting(false);
    }
  }, [fitView, getViewport, isExporting, setViewport, workflowName, reactFlowWrapper]);

  return { minimapVisible, isExporting, toggleMinimap, exportCanvas };
}
