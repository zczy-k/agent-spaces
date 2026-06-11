import React, { useCallback, useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';

export function useCanvasExport(
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>,
  workflowName: string,
) {
  const { getViewport, setViewport, getNodes } = useReactFlow();
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
    const viewportEl = reactFlowWrapper.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewportEl || isExporting) return;

    setIsExporting(true);
    const viewport = getViewport();
    try {
      const nodesBounds = getNodesBounds(getNodes());
      const imageWidth = 1024;
      const imageHeight = 768;
      const { x, y, zoom } = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2, 0.15);

      const name = (workflowName || 'workflow').replace(/[^\w一-龥-]+/g, '-');
      const toImage = format === 'jpeg' ? toJpeg : toPng;
      const dataUrl = await toImage(viewportEl, {
        backgroundColor: format === 'jpeg' ? '#ffffff' : undefined,
        quality: format === 'jpeg' ? 0.95 : undefined,
        pixelRatio: 2,
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      });

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
  }, [getNodes, getViewport, isExporting, setViewport, workflowName, reactFlowWrapper]);

  return { minimapVisible, isExporting, toggleMinimap, exportCanvas };
}
