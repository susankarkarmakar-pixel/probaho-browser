import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Eraser, Highlighter, PenLine, RotateCw, StickyNote, Trash2, Undo2 } from 'lucide-react';

type AnnotationTool = 'select' | 'highlight' | 'pen' | 'text' | 'eraser';
type Point = { x: number; y: number };
export type Annotation = {
  id: string;
  type: Exclude<AnnotationTool, 'select' | 'eraser'>;
  color: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
};

type AnnotationLayerProps = {
  documentKey: string;
  width?: number;
  height?: number;
  active?: boolean;
  showToolbar?: boolean;
  privateMode?: boolean;
  onExportPdf?: () => Promise<void> | void;
  className?: string;
};

const DEFAULT_COLOR = '#facc15';
const STORAGE_PREFIX = 'probaho-annotations:';

function loadAnnotations(documentKey: string, privateMode: boolean): Annotation[] {
  if (privateMode) return [];
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${documentKey}`);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  documentKey,
  width,
  height,
  active = true,
  showToolbar = true,
  privateMode = false,
  onExportPdf,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<Annotation | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('select');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadAnnotations(documentKey, privateMode));
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const persist = useCallback((next: Annotation[]) => {
    if (privateMode) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${documentKey}`, JSON.stringify(next));
    } catch {}
  }, [documentKey, privateMode]);

  useEffect(() => {
    setAnnotations(loadAnnotations(documentKey, privateMode));
    setHistory([]);
    setFuture([]);
  }, [documentKey, privateMode]);

  const commit = useCallback((next: Annotation[]) => {
    setHistory(previous => [...previous.slice(-49), annotations]);
    setFuture([]);
    setAnnotations(next);
    persist(next);
  }, [annotations, persist]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = width || rect.width;
    const nextHeight = height || rect.height;
    if (!nextWidth || !nextHeight) return;
    canvas.width = Math.max(1, Math.round(nextWidth * dpr));
    canvas.height = Math.max(1, Math.round(nextHeight * dpr));
    canvas.style.width = `${nextWidth}px`;
    canvas.style.height = `${nextHeight}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, nextWidth, nextHeight);
    annotations.forEach(annotation => {
      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      if (annotation.type === 'highlight') {
        context.globalAlpha = 0.34;
        context.fillStyle = annotation.color;
        context.fillRect(annotation.x * nextWidth, annotation.y * nextHeight, (annotation.width || 0) * nextWidth, (annotation.height || 0) * nextHeight);
      } else if (annotation.type === 'pen' && annotation.points?.length) {
        context.globalAlpha = 0.9;
        context.strokeStyle = annotation.color;
        context.lineWidth = 3;
        context.beginPath();
        annotation.points.forEach((point, index) => {
          const x = point.x * nextWidth;
          const y = point.y * nextHeight;
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.stroke();
      } else if (annotation.type === 'text' && annotation.text) {
        const x = annotation.x * nextWidth;
        const y = annotation.y * nextHeight;
        context.globalAlpha = 1;
        context.font = '600 15px system-ui, sans-serif';
        context.fillStyle = annotation.color;
        context.shadowColor = 'rgba(0,0,0,0.35)';
        context.shadowBlur = 3;
        context.fillText(annotation.text, x, y);
      }
      context.restore();
    });
    if (drawingRef.current) {
      const draft = drawingRef.current;
      context.save();
      context.strokeStyle = draft.color;
      context.fillStyle = draft.color;
      context.globalAlpha = draft.type === 'highlight' ? 0.25 : 0.8;
      if (draft.type === 'highlight') context.fillRect(draft.x * nextWidth, draft.y * nextHeight, (draft.width || 0) * nextWidth, (draft.height || 0) * nextHeight);
      if (draft.type === 'pen' && draft.points?.length) {
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.beginPath();
        draft.points.forEach((point, index) => index === 0 ? context.moveTo(point.x * nextWidth, point.y * nextHeight) : context.lineTo(point.x * nextWidth, point.y * nextHeight));
        context.stroke();
      }
      context.restore();
    }
  }, [annotations, height, width]);

  useEffect(() => {
    redraw();
    const observer = new ResizeObserver(redraw);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener('resize', redraw);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', redraw);
    };
  }, [redraw]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || tool === 'select') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    if (tool === 'text') {
      const text = window.prompt('Add a note:');
      if (text?.trim()) commit([...annotations, { id: crypto.randomUUID(), type: 'text', color, x: point.x, y: point.y, text: text.trim() }]);
      return;
    }
    if (tool === 'eraser') {
      const target = annotations.find(annotation => Math.abs(annotation.x - point.x) < 0.06 && Math.abs(annotation.y - point.y) < 0.06);
      if (target) commit(annotations.filter(annotation => annotation.id !== target.id));
      return;
    }
    const draft: Annotation = tool === 'pen'
      ? { id: crypto.randomUUID(), type: 'pen', color, x: point.x, y: point.y, points: [point] }
      : { id: crypto.randomUUID(), type: 'highlight', color, x: point.x, y: point.y, width: 0, height: 0 };
    drawingRef.current = draft;
    setIsDrawing(true);
    redraw();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingRef.current) return;
    const point = getPoint(event);
    const draft = drawingRef.current;
    if (draft.type === 'pen') draft.points = [...(draft.points || []), point];
    else {
      draft.width = point.x - draft.x;
      draft.height = point.y - draft.y;
    }
    redraw();
  };

  const handlePointerUp = () => {
    if (!isDrawing || !drawingRef.current) return;
    const draft = drawingRef.current;
    drawingRef.current = null;
    setIsDrawing(false);
    if (draft.type === 'highlight' && (draft.width || 0) < 0) {
      draft.x += draft.width || 0;
      draft.width = Math.abs(draft.width || 0);
    }
    if (draft.type === 'highlight' && (draft.height || 0) < 0) {
      draft.y += draft.height || 0;
      draft.height = Math.abs(draft.height || 0);
    }
    if (draft.type === 'pen' && (draft.points?.length || 0) < 2) return;
    commit([...annotations, draft]);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture(next => [annotations, ...next]);
    setHistory(next => next.slice(0, -1));
    setAnnotations(previous);
    persist(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory(previous => [...previous, annotations]);
    setFuture(previous => previous.slice(1));
    setAnnotations(next);
    persist(next);
  };

  const clear = () => {
    if (annotations.length > 0) commit([]);
  };

  const exportAnnotationData = () => {
    const blob = new Blob([JSON.stringify({ documentKey, annotations }, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `probaho-annotations-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleExport = async () => {
    setExportBusy(true);
    setExportMessage(null);
    try {
      if (onExportPdf) await onExportPdf();
      else exportAnnotationData();
      setExportMessage(onExportPdf ? 'Annotated PDF ready to save.' : 'Annotation data exported.');
    } catch (error: any) {
      setExportMessage(error?.message || 'Export failed.');
    } finally {
      setExportBusy(false);
      window.setTimeout(() => setExportMessage(null), 3200);
    }
  };

  return (
    <div ref={wrapRef} className={`annotation-layer ${className}`} data-testid="annotation-layer" style={{ width: width || '100%', height: height || '100%' }}>
      {showToolbar && (
        <div className="annotation-toolbar" data-testid="annotation-toolbar" role="toolbar" aria-label="Document annotation tools" onPointerDown={event => event.stopPropagation()}>
          <button type="button" className={tool === 'select' ? 'is-active' : ''} aria-label="Select annotations" title="Select" onClick={() => setTool('select')}><ChevronDown size={14} /></button>
          <button type="button" className={tool === 'highlight' ? 'is-active' : ''} aria-label="Highlight" title="Highlight" onClick={() => setTool('highlight')}><Highlighter size={14} /></button>
          <button type="button" className={tool === 'pen' ? 'is-active' : ''} aria-label="Draw mark" title="Draw mark" onClick={() => setTool('pen')}><PenLine size={14} /></button>
          <button type="button" className={tool === 'text' ? 'is-active' : ''} aria-label="Add text note" title="Add text note" onClick={() => setTool('text')}><StickyNote size={14} /></button>
          <button type="button" className={tool === 'eraser' ? 'is-active' : ''} aria-label="Erase annotation" title="Erase annotation" onClick={() => setTool('eraser')}><Eraser size={14} /></button>
          <label className="annotation-color" title="Annotation color" style={{ '--annotation-color': color } as React.CSSProperties}>
            <span className="sr-only">Annotation color</span>
            <input type="color" value={color} onChange={event => setColor(event.target.value)} />
          </label>
          <span className="annotation-toolbar-divider" />
          <button type="button" aria-label="Undo annotation" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={14} /></button>
          <button type="button" aria-label="Redo annotation" title="Redo" onClick={redo} disabled={!future.length}><RotateCw size={14} /></button>
          <button type="button" aria-label="Clear annotations" title="Clear annotations" onClick={clear} disabled={!annotations.length}><Trash2 size={14} /></button>
          <button type="button" aria-label={onExportPdf ? 'Export annotated PDF' : 'Export annotations'} title={onExportPdf ? 'Export annotated PDF' : 'Export annotations'} onClick={handleExport} disabled={exportBusy}><Download size={14} /></button>
          {exportMessage && <span className="annotation-export-status" role="status">{exportMessage}</span>}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`annotation-canvas ${active ? 'is-active' : ''}`}
        aria-label="Annotation canvas"
        style={{ pointerEvents: active && tool !== 'select' ? 'auto' : 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
};

export default AnnotationLayer;
